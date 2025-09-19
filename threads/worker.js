"use strict";

function worker_app_show_msg(main_obj, msg)
{
	"use strict";
	const idx = main_obj.idx;
	const message = `Worker id ${idx}: "${msg}".`;
	console.log(message);
}

function worker_app_show_err_msg(main_obj, msg)
{
	"use strict";
	const message = `Error! ${msg}`;
	worker_app_show_msg(main_obj, message);
}

function worker_app_show_err_reason(main_obj, reason, msg)
{
	"use strict";
	const message = `Message: ${msg} Reason: ${reason}.`;
	worker_app_show_err_msg(main_obj, message);
}

function worker_app_perform_wasm_computation(main_obj)
{
	"use strict";
	const input = main_obj.input;
	if(input === null)
	{
		postMessage(null);
		return;
	}
	if(input >= 9000)
	{
		return;
	}
	const result = main_obj.wi.exports.threads(input);
	const msg = `Result of WASM computation is: ${result}.`;
	worker_app_show_msg(main_obj, msg);
	postMessage({ result: result, });
}

function worker_app_on_wasm_loaded_gud(main_obj, result_object)
{
	"use strict";
	worker_app_show_msg(main_obj, "WASM instantiated.");
	main_obj.wm = result_object.module;
	main_obj.wi = result_object.instance;
	worker_app_perform_wasm_computation(main_obj);
}

function worker_app_on_wasm_loaded_bad(main_obj, reason)
{
	"use strict";
	worker_app_show_err_reason(main_obj, reason, "Failed to instanciate WASM module.");
}

function worker_app_on_chunk_done_bad(main_obj, reason)
{
	"use strict";
	worker_app_show_err_reason(main_obj, reason, "Input stream became errored.");
}

function worker_app_on_chunk_done_gud(main_obj, reader, controller, self, chunk_done)
{
	"use strict";
	if(chunk_done.done)
	{
		const bytes_string = main_obj.wasm_bytes.toLocaleString();
		worker_app_show_msg(main_obj, `Download finished, got ${bytes_string} bytes.`);
		controller.close();
	}
	else
	{
		const chunk = chunk_done.value;
		const bytes_cnt_new = main_obj.wasm_bytes + chunk.length;
		main_obj.wasm_bytes = bytes_cnt_new;
		const kbs = Math.trunc(bytes_cnt_new / 1024).toLocaleString();
		const msg = `Downloading WASM ${kbs} kB.`;
		worker_app_show_msg(main_obj, msg);
		controller.enqueue(chunk);
		const chunk_done_p = reader.read();
		chunk_done_p.then
		(
			function(chunk_done){ "use strict"; self(main_obj, reader, controller, self, chunk_done); },
			function(reason){ "use strict"; worker_app_on_chunk_done_bad(main_obj, reason); }
		);
	}
}

function worker_app_on_reader_start(main_obj, reader, controller)
{
	"use strict";
	const chunk_done_p = reader.read();
	chunk_done_p.then
	(
		function(chunk_done){ "use strict"; worker_app_on_chunk_done_gud(main_obj, reader, controller, worker_app_on_chunk_done_gud, chunk_done); },
		function(reason){ "use strict"; worker_app_on_chunk_done_bad(main_obj, reason); }
	);
}

function worker_app_js_console_log(main_obj, str_ptr, str_len)
{
	"use strict";
	const str_buf = new Uint8Array(main_obj.mem.buffer, str_ptr, str_len);
	const str_obj = new TextDecoder().decode(str_buf);
	worker_app_show_msg(main_obj, str_obj);
}

function worker_app_create_import_obj(main_obj)
{
	"use strict";
	const mem = new WebAssembly.Memory({ initial: 32, maximum: 32, shared: false, }); /* 32 * 64 kB == 2 MB */
	const stack_ptr = new WebAssembly.Global({ value: "i32", mutable: true, }, 1 * 1024 * 1024); /* 1 MB stack */
	const memory_base = new WebAssembly.Global({ value: "i32", mutable: false, }, 0);
	const import_console_log = function(str_ptr, str_len){ "use strict"; worker_app_js_console_log(main_obj, str_ptr, str_len); }
	main_obj.mem = mem;
	const import_obj =
	{
		env:
		{
			memory: mem,
			__stack_pointer: stack_ptr,
			__memory_base: memory_base,
			js_console_log: import_console_log,
		},
	};
	return import_obj;
}

function worker_app_fetch_wasm_gud(main_obj, response)
{
	"use strict";
	if(!response.ok)
	{
		worker_app_show_err_msg(main_obj, "Failed to get WASM module.");
		return;
	}
	const readable_stream_orig = response.body;
	if(readable_stream_orig === null)
	{
		worker_app_show_err_msg(main_obj, "WASM response has no body.");
		return;
	}
	const response_orig = response;
	const reader_orig = readable_stream_orig.getReader();
	const underlying_source_my = { start: function(controller){ "use strict"; return worker_app_on_reader_start(main_obj, reader_orig, controller); }, };
	const readable_stream_my = new ReadableStream(underlying_source_my);
	const options_my = { status: response_orig.status, statusText: response_orig.statusText, headers: response_orig.headers, };
	const response_my = new Response(readable_stream_my, options_my);
	const import_obj = worker_app_create_import_obj(main_obj);
	const result_object_p = WebAssembly.instantiateStreaming(response_my, import_obj);
	result_object_p.then
	(
		function(result_object){ "use strict"; worker_app_on_wasm_loaded_gud(main_obj, result_object); },
		function(reason){ "use strict"; worker_app_on_wasm_loaded_bad(main_obj, reason); }
	);
}

function worker_app_fetch_wasm_bad(main_obj, reason)
{
	"use strict";
	worker_app_show_err_reason(main_obj, reason, "Failed to fetch WASM module.");
}

function worker_app_fetch_wasm(main_obj)
{
	"use strict";
	const response_p = fetch("threads.wasm");
	response_p.then
	(
		function(response){ "use strict"; worker_app_fetch_wasm_gud(main_obj, response); },
		function(reason){ "use strict"; worker_app_fetch_wasm_bad(main_obj, reason); }
	);
}

function worker_app_create_main_obj(idx)
{
	"use strict";
	const main_obj =
	{
		idx: idx,
		mem: null,
		wm: null,
		wi: null,
		wasm_bytes: 0,
		input: null,
	};
	return main_obj;
}

let worker_global = null;

function worker_app_on_message(message_event)
{
	"use strict";
	if(worker_global === null)
	{
		const idx = message_event.data.idx;
		console.log(`Worker id ${idx} is here.`);
		const main_obj = worker_app_create_main_obj(idx);
		worker_global = main_obj;
		worker_app_fetch_wasm(main_obj);
	}
	else
	{
		const main_obj = worker_global;
		const idx = main_obj.idx;
		console.log(`Worker id ${idx} is here.`);
		const input = message_event.data.input;
		main_obj.input = input;
		worker_app_perform_wasm_computation(main_obj);
	}
}

onmessage = worker_app_on_message;

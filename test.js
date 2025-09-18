"use strict";

function test_app_show_msg(main_obj, msg)
{
	"use strict";
	console.log(msg);
	document.getElementById("out").textContent += "\n";
	document.getElementById("out").textContent += msg;
}

function test_app_show_err_msg(main_obj, msg)
{
	"use strict";
	const message = `Error! ${msg}`;
	test_app_show_msg(main_obj, message);
}

function test_app_show_err_reason(main_obj, reason, msg)
{
	"use strict";
	const message = `Message: ${msg} Reason: ${reason}.`;
	test_app_show_err_msg(main_obj, message);
}

function test_app_perform_wasm_computation(main_obj)
{
	"use strict";
	const result = main_obj.wi.exports.test(2, 3);
	const msg = `Result of wasm computation is: ${result}.`;
	test_app_show_msg(main_obj, msg);
}

function test_app_on_wasm_loaded_gud(main_obj, result_object)
{
	"use strict";
	test_app_show_msg(main_obj, "WASM instantiated.");
	main_obj.wm = result_object.module;
	main_obj.wi = result_object.instance;
	test_app_perform_wasm_computation(main_obj);
}

function test_app_on_wasm_loaded_bad(main_obj, reason)
{
	"use strict";
	test_app_show_err_reason(main_obj, reason, "Failed to instanciate WASM module.");
}

function test_app_on_chunk_done_bad(main_obj, reason)
{
	"use strict";
	test_app_show_err_reason(main_obj, reason, "Input stream became errored.");
}

function test_app_on_chunk_done_gud(main_obj, reader, controller, self, chunk_done)
{
	"use strict";
	if(chunk_done.done)
	{
		const bytes_string = main_obj.wasm_bytes.toLocaleString();
		test_app_show_msg(main_obj, `Download finished, got ${bytes_string} bytes.`);
		controller.close();
	}
	else
	{
		const chunk = chunk_done.value;
		const bytes_cnt_new = main_obj.wasm_bytes + chunk.length;
		main_obj.wasm_bytes = bytes_cnt_new;
		const kbs = Math.trunc(bytes_cnt_new / 1024).toLocaleString();
		const msg = `Downloading WASM ${kbs} kB.`;
		test_app_show_msg(main_obj, msg);
		controller.enqueue(chunk);
		const chunk_done_p = reader.read();
		chunk_done_p.then
		(
			function(chunk_done){ "use strict"; self(main_obj, reader, controller, self, chunk_done); },
			function(reason){ "use strict"; test_app_on_chunk_done_bad(main_obj, reason); }
		);
	}
}

function test_app_on_reader_start(main_obj, reader, controller)
{
	"use strict";
	const chunk_done_p = reader.read();
	chunk_done_p.then
	(
		function(chunk_done){ "use strict"; test_app_on_chunk_done_gud(main_obj, reader, controller, test_app_on_chunk_done_gud, chunk_done); },
		function(reason){ "use strict"; test_app_on_chunk_done_bad(main_obj, reason); }
	);
}

function test_app_js_console_log(main_obj, str_ptr, str_len)
{
	"use strict";
	const str_buf = new Uint8Array(main_obj.mem.buffer, str_ptr, str_len);
	const str_obj = new TextDecoder().decode(str_buf);
	test_app_show_msg(main_obj, str_obj);
}

function test_app_create_import_obj(main_obj)
{
	"use strict";
	const mem = new WebAssembly.Memory({initial: 32, maximum: 32, }); /* 32 * 64 kB == 2 MB */
	const stack_ptr = new WebAssembly.Global({value: "i32", mutable: true, }, 1 * 1024 * 1024); /* 1 MB stack */
	const memory_base = new WebAssembly.Global({value: "i32", mutable: false, }, 0);
	const import_console_log = function(str_ptr, str_len){ "use strict"; test_app_js_console_log(main_obj, str_ptr, str_len); }
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

function test_app_fetch_wasm_gud(main_obj, response)
{
	"use strict";
	if(!response.ok)
	{
		test_app_show_err_msg(main_obj, "Failed to get WASM module.");
		return;
	}
	const readable_stream_orig = response.body;
	if(readable_stream_orig === null)
	{
		test_app_show_err_msg(main_obj, "WASM response has no body.");
		return;
	}
	const response_orig = response;
	const reader_orig = readable_stream_orig.getReader();
	const underlying_source_my = { start: function(controller){ "use strict"; return test_app_on_reader_start(main_obj, reader_orig, controller); }, };
	const readable_stream_my = new ReadableStream(underlying_source_my);
	const options_my = { status: response_orig.status, statusText: response_orig.statusText, headers: response_orig.headers, };
	const response_my = new Response(readable_stream_my, options_my);
	const import_obj = test_app_create_import_obj(main_obj);
	const result_object_p = WebAssembly.instantiateStreaming(response_my, import_obj);
	result_object_p.then
	(
		function(result_object){ "use strict"; test_app_on_wasm_loaded_gud(main_obj, result_object); },
		function(reason){ "use strict"; test_app_on_wasm_loaded_bad(main_obj, reason); }
	);
}

function test_app_fetch_wasm_bad(main_obj, reason)
{
	"use strict";
	test_app_show_err_reason(main_obj, reason, "Failed to fetch WASM module.");
}

function test_app_fetch_wasm(main_obj)
{
	"use strict";
	const response_p = window.fetch("test.wasm");
	response_p.then
	(
		function(response){ "use strict"; test_app_fetch_wasm_gud(main_obj, response); },
		function(reason){ "use strict"; test_app_fetch_wasm_bad(main_obj, reason); }
	);
}

function test_app_create_main_obj()
{
	"use strict";
	const main_obj =
	{
		mem: null,
		wm: null,
		wi: null,
		wasm_bytes: 0,
	};
	return main_obj;
}

function test_app_on_window_loaded()
{
	"use strict";
	const main_obj = test_app_create_main_obj();
	test_app_show_msg(main_obj, "JavaScript enabled.")
	test_app_fetch_wasm(main_obj);
}

function test_app_start()
{
	"use strict";
	window.addEventListener("load", test_app_on_window_loaded);
}

test_app_start();

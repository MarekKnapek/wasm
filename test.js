"use strict";

function test_js_console_log(main_obj, str_ptr, str_len)
{
	"use strict";
	const str_buf = new Uint8Array(main_obj.mem.buffer, str_ptr, str_len);
	const str_obj = new TextDecoder().decode(str_buf);
	console.log(str_obj);
}

function test_perform_wasm_computation(main_obj)
{
	"use strict";
	const result = main_obj.wi.exports.test(2, 3);
	console.log("result of wasm computation is: " + result);
}

function test_fetch_wasm_gud(main_obj, wm)
{
	"use strict";
	main_obj.wm = wm;
	main_obj.wi = wm.instance;
	test_perform_wasm_computation(main_obj);
}

function test_fetch_wasm_bad(main_obj, reason)
{
	"use strict";
	console.log(reason);
}

function test_create_import_obj(main_obj)
{
	"use strict";
	const mem = new WebAssembly.Memory({initial: 32, maximum: 32,}); /* 32 * 64 kB == 2 MB */
	main_obj.mem = mem;
	const import_object =
	{
		env:
		{
			memory: mem,
			__stack_pointer: new WebAssembly.Global({value: "i32", mutable: true, }, 1 * 1024 * 1024), /* 1 MB stack */
			__memory_base: new WebAssembly.Global({value: "i32", mutable: false, }, 0),
			js_console_log: function(str_ptr, str_len){ test_js_console_log(main_obj, str_ptr, str_len); },
		},
	};
	return import_object;
}

function test_fetch_wasm(main_obj)
{
	"use strict";
	const import_object = test_create_import_obj(main_obj);
	const fp = fetch("test.wasm");
	const wp = WebAssembly.instantiateStreaming(fp, import_object);
	wp.then(function(wm){ test_fetch_wasm_gud(main_obj, wm); }, function(reason){ test_fetch_wasm_bad(main_obj, reason); });
}

function test_create_main_obj()
{
	"use strict";
	const main_obj =
	{
		mem: null,
		wm: null,
		wi: null,
	};
	return main_obj;
}

function test_on_window_loaded()
{
	"use strict";
	const main_obj = test_create_main_obj();
	test_fetch_wasm(main_obj);
}

function test_start()
{
	"use strict";
	window.addEventListener("load", test_on_window_loaded);
}

test_start();

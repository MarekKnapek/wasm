#include <emscripten.h>


#define string_literal(x) x, sizeof(x) - 1


extern void js_console_log(char const* const str_ptr, int const str_len);


EMSCRIPTEN_KEEPALIVE int threads(int const x)
{
	int r;

	js_console_log(string_literal("This is message from C code."));
	r = x + 1000;
	return r;
}

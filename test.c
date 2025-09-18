#include <emscripten.h>

extern void js_console_log(char const* const str_ptr, int const str_len);

void my_memcpy(char* const dst, char const* const src, int const len)
{
	int i;

	for(i = 0; i != len; ++i)
	{
		dst[i] = src[i];
	}
}

EMSCRIPTEN_KEEPALIVE int test(int const a, int const b)
{
	#define msg "Performing the 'test' computation."

	char stack_buf[64];
	int c;

	my_memcpy(&stack_buf[0], &msg[0], sizeof(msg) - 1);
	js_console_log(&stack_buf[0], sizeof(msg) - 1);
	c = a + b;
	return c;
}

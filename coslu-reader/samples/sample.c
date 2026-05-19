/* Coslu Reader — sample C (Tier S via Shiki) */
#include <stdio.h>
#include <stdlib.h>

#define MAX 42

typedef struct {
    const char *nome;
    int  tier;
} Familia;

int soma(int a, int b) {
    return a + b; // comentário inline
}

int main(int argc, char **argv) {
    Familia f = { .nome = "coslu", .tier = 1 };
    for (int i = 0; i < MAX; i++) {
        printf("%s #%d => %d\n", f.nome, i, soma(i, f.tier));
    }
    return EXIT_SUCCESS;
}

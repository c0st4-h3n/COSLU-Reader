; Coslu Reader — sample x86-64 Assembly (Tier S via Shiki)
section .data
    msg     db  "COSLU LABZ", 10
    msglen  equ $ - msg

section .text
    global _start

_start:
    mov     rax, 1          ; sys_write
    mov     rdi, 1          ; stdout
    lea     rsi, [rel msg]
    mov     rdx, msglen
    syscall

    mov     rax, 60         ; sys_exit
    xor     rdi, rdi
    syscall

// Decompiled code for requirements.txt
// Processor: ARM:LE:32:v6


/* WARNING: Control flow encountered bad instruction data */

void Reset(void)

{
  bool in_CY;
  undefined4 in_cr1;
  undefined4 in_cr7;
  undefined4 in_cr9;
  
  if (!in_CY) {
    coprocessor_function(0,6,3,in_cr7,in_cr9,in_cr1);
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void UndefinedInstruction(void)

{
  bool in_CY;
  undefined4 in_cr1;
  undefined4 in_cr7;
  undefined4 in_cr9;
  
  if (!in_CY) {
    coprocessor_function(0,6,3,in_cr7,in_cr9,in_cr1);
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void PrefetchAbort(undefined4 param_1,undefined4 param_2,uint param_3)

{
  uint uVar1;
  uint unaff_r4;
  undefined4 unaff_r5;
  int unaff_r6;
  undefined1 unaff_r7;
  undefined1 *unaff_r9;
  undefined1 *in_r12;
  undefined1 *puVar2;
  uint in_lr;
  bool in_CY;
  bool in_OV;
  undefined4 in_cr0;
  undefined4 in_cr2;
  undefined4 in_cr3;
  undefined4 in_cr6;
  undefined4 in_cr14;
  
  if (in_OV) {
    in_lr = *(uint *)(unaff_r6 + -4);
    register0x00000054 = *(BADSPACEBASE **)(unaff_r6 + -8);
    in_r12 = *(undefined1 **)(unaff_r6 + -0xc);
    param_2 = *(undefined4 *)(unaff_r6 + -0x1c);
    coprocessor_function(0xf,7,3,in_cr6,in_cr2,in_cr3);
  }
  if (in_CY) {
    uVar1 = coprocessor_movefromRt(0xd,1,1,in_cr0,in_cr14);
  }
  else {
    uVar1 = in_lr ^ param_3 >> (param_3 & 0xff);
  }
  if (!in_OV) {
    unaff_r7 = *unaff_r9;
  }
  if (in_CY) {
    in_lr = in_lr - 0x1a0;
    coprocessor_storelong(0xf,in_cr6,in_lr);
  }
  puVar2 = in_r12;
  if (!in_OV) {
    puVar2 = in_r12 + -0x56d;
    *in_r12 = unaff_r7;
  }
  if (!in_CY) {
    uVar1 = unaff_r4 >> (in_lr & 0x1f) | unaff_r4 << 0x20 - (in_lr & 0x1f);
    in_CY = (in_lr & 0xff) != 0 && SUB41(uVar1 >> 0x1f,0);
    uVar1 = (uint)register0x00000054 ^ uVar1;
  }
  if (!in_CY) {
    *(BADSPACEBASE **)(in_lr - 4) = register0x00000054;
    *(undefined1 **)(in_lr - 8) = puVar2;
    *(undefined4 *)(in_lr - 0xc) = unaff_r5;
    *(uint *)(in_lr - 0x10) = uVar1;
    *(uint *)(in_lr - 0x14) = param_3;
    *(undefined4 *)(in_lr - 0x18) = param_2;
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void DataAbort(undefined4 param_1,undefined4 param_2,uint param_3)

{
  uint uVar1;
  uint unaff_r4;
  undefined4 unaff_r5;
  int unaff_r6;
  undefined1 unaff_r7;
  undefined1 *unaff_r9;
  undefined1 *in_r12;
  undefined1 *puVar2;
  uint in_lr;
  bool in_CY;
  bool in_OV;
  undefined4 in_cr0;
  undefined4 in_cr2;
  undefined4 in_cr3;
  undefined4 in_cr6;
  undefined4 in_cr14;
  
  if (in_OV) {
    in_lr = *(uint *)(unaff_r6 + -4);
    register0x00000054 = *(BADSPACEBASE **)(unaff_r6 + -8);
    in_r12 = *(undefined1 **)(unaff_r6 + -0xc);
    param_2 = *(undefined4 *)(unaff_r6 + -0x1c);
    coprocessor_function(0xf,7,3,in_cr6,in_cr2,in_cr3);
  }
  if (in_CY) {
    uVar1 = coprocessor_movefromRt(0xd,1,1,in_cr0,in_cr14);
  }
  else {
    uVar1 = in_lr ^ param_3 >> (param_3 & 0xff);
  }
  if (!in_OV) {
    unaff_r7 = *unaff_r9;
  }
  if (in_CY) {
    in_lr = in_lr - 0x1a0;
    coprocessor_storelong(0xf,in_cr6,in_lr);
  }
  puVar2 = in_r12;
  if (!in_OV) {
    puVar2 = in_r12 + -0x56d;
    *in_r12 = unaff_r7;
  }
  if (!in_CY) {
    uVar1 = unaff_r4 >> (in_lr & 0x1f) | unaff_r4 << 0x20 - (in_lr & 0x1f);
    in_CY = (in_lr & 0xff) != 0 && SUB41(uVar1 >> 0x1f,0);
    uVar1 = (uint)register0x00000054 ^ uVar1;
  }
  if (!in_CY) {
    *(BADSPACEBASE **)(in_lr - 4) = register0x00000054;
    *(undefined1 **)(in_lr - 8) = puVar2;
    *(undefined4 *)(in_lr - 0xc) = unaff_r5;
    *(uint *)(in_lr - 0x10) = uVar1;
    *(uint *)(in_lr - 0x14) = param_3;
    *(undefined4 *)(in_lr - 0x18) = param_2;
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void NotUsed(undefined4 param_1,undefined4 param_2,uint param_3)

{
  uint uVar1;
  uint unaff_r4;
  undefined4 unaff_r5;
  undefined1 unaff_r7;
  undefined1 *unaff_r9;
  undefined1 *in_r12;
  undefined1 *puVar2;
  uint in_lr;
  bool in_CY;
  bool in_OV;
  undefined4 in_cr0;
  undefined4 in_cr2;
  undefined4 in_cr3;
  undefined4 in_cr6;
  undefined4 in_cr14;
  
  if (in_OV) {
    coprocessor_function(0xf,7,3,in_cr6,in_cr2,in_cr3);
  }
  if (in_CY) {
    uVar1 = coprocessor_movefromRt(0xd,1,1,in_cr0,in_cr14);
  }
  else {
    uVar1 = in_lr ^ param_3 >> (param_3 & 0xff);
  }
  if (!in_OV) {
    unaff_r7 = *unaff_r9;
  }
  if (in_CY) {
    in_lr = in_lr - 0x1a0;
    coprocessor_storelong(0xf,in_cr6,in_lr);
  }
  puVar2 = in_r12;
  if (!in_OV) {
    puVar2 = in_r12 + -0x56d;
    *in_r12 = unaff_r7;
  }
  if (!in_CY) {
    uVar1 = unaff_r4 >> (in_lr & 0x1f) | unaff_r4 << 0x20 - (in_lr & 0x1f);
    in_CY = (in_lr & 0xff) != 0 && SUB41(uVar1 >> 0x1f,0);
    uVar1 = (uint)&stack0x00000000 ^ uVar1;
  }
  if (!in_CY) {
    *(BADSPACEBASE **)(in_lr - 4) = register0x00000054;
    *(undefined1 **)(in_lr - 8) = puVar2;
    *(undefined4 *)(in_lr - 0xc) = unaff_r5;
    *(uint *)(in_lr - 0x10) = uVar1;
    *(uint *)(in_lr - 0x14) = param_3;
    *(undefined4 *)(in_lr - 0x18) = param_2;
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void IRQ(undefined4 param_1,undefined4 param_2,uint param_3)

{
  uint uVar1;
  uint unaff_r4;
  undefined4 unaff_r5;
  undefined1 unaff_r7;
  undefined1 *unaff_r9;
  undefined1 *in_r12;
  undefined1 *puVar2;
  uint in_lr;
  bool in_CY;
  bool in_OV;
  undefined4 in_cr0;
  undefined4 in_cr6;
  undefined4 in_cr14;
  
  if (in_CY) {
    uVar1 = coprocessor_movefromRt(0xd,1,1,in_cr0,in_cr14);
  }
  else {
    uVar1 = in_lr ^ param_3 >> (param_3 & 0xff);
  }
  if (!in_OV) {
    unaff_r7 = *unaff_r9;
  }
  if (in_CY) {
    in_lr = in_lr - 0x1a0;
    coprocessor_storelong(0xf,in_cr6,in_lr);
  }
  puVar2 = in_r12;
  if (!in_OV) {
    puVar2 = in_r12 + -0x56d;
    *in_r12 = unaff_r7;
  }
  if (!in_CY) {
    uVar1 = unaff_r4 >> (in_lr & 0x1f) | unaff_r4 << 0x20 - (in_lr & 0x1f);
    in_CY = (in_lr & 0xff) != 0 && SUB41(uVar1 >> 0x1f,0);
    uVar1 = (uint)&stack0x00000000 ^ uVar1;
  }
  if (!in_CY) {
    *(BADSPACEBASE **)(in_lr - 4) = register0x00000054;
    *(undefined1 **)(in_lr - 8) = puVar2;
    *(undefined4 *)(in_lr - 0xc) = unaff_r5;
    *(uint *)(in_lr - 0x10) = uVar1;
    *(uint *)(in_lr - 0x14) = param_3;
    *(undefined4 *)(in_lr - 0x18) = param_2;
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




/* WARNING: Control flow encountered bad instruction data */

void FIQ(undefined4 param_1,undefined4 param_2,uint param_3,uint param_4)

{
  uint unaff_r4;
  undefined4 unaff_r5;
  undefined1 unaff_r7;
  undefined1 *unaff_r9;
  undefined1 *in_r12;
  undefined1 *puVar1;
  uint in_lr;
  bool in_CY;
  bool in_OV;
  undefined4 in_cr6;
  
  if (!in_CY) {
    param_4 = in_lr ^ param_3 >> (param_3 & 0xff);
  }
  if (!in_OV) {
    unaff_r7 = *unaff_r9;
  }
  if (in_CY) {
    in_lr = in_lr - 0x1a0;
    coprocessor_storelong(0xf,in_cr6,in_lr);
  }
  puVar1 = in_r12;
  if (!in_OV) {
    puVar1 = in_r12 + -0x56d;
    *in_r12 = unaff_r7;
  }
  if (!in_CY) {
    param_4 = unaff_r4 >> (in_lr & 0x1f) | unaff_r4 << 0x20 - (in_lr & 0x1f);
    in_CY = (in_lr & 0xff) != 0 && SUB41(param_4 >> 0x1f,0);
    param_4 = (uint)&stack0x00000000 ^ param_4;
  }
  if (!in_CY) {
    *(BADSPACEBASE **)(in_lr - 4) = register0x00000054;
    *(undefined1 **)(in_lr - 8) = puVar1;
    *(undefined4 *)(in_lr - 0xc) = unaff_r5;
    *(uint *)(in_lr - 0x10) = param_4;
    *(uint *)(in_lr - 0x14) = param_3;
    *(undefined4 *)(in_lr - 0x18) = param_2;
  }
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}




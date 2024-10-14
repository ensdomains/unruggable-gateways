// program ops
// the following should be equivalent to GatewayProtocol.sol
// not sure what to call this thing OPCODE? OP?
export const GATEWAY_OP = {
  PUSH_0: 0,
  PUSH_1: 1,
  PUSH_2: 2,
  PUSH_3: 3,
  PUSH_4: 4,
  PUSH_5: 5,
  PUSH_6: 6,
  PUSH_7: 7,
  PUSH_8: 8,
  PUSH_9: 9,
  PUSH_10: 10,
  PUSH_11: 11,
  PUSH_12: 12,
  PUSH_13: 13,
  PUSH_14: 14,
  PUSH_15: 15,
  PUSH_16: 16,
  PUSH_17: 17,
  PUSH_18: 18,
  PUSH_19: 19,
  PUSH_20: 20,
  PUSH_21: 21,
  PUSH_22: 22,
  PUSH_23: 23,
  PUSH_24: 24,
  PUSH_25: 25,
  PUSH_26: 26,
  PUSH_27: 27,
  PUSH_28: 28,
  PUSH_29: 29,
  PUSH_30: 30,
  PUSH_31: 31,
  PUSH_32: 32,

  GET_SLOT: 33,
  GET_TARGET: 34,
  STACK_SIZE: 35,
  IS_CONTRACT: 36,

  PUSH_BYTES: 40,
  PUSH_STACK: 41,
  PUSH_OUTPUT: 42,

  SET_TARGET: 50,
  SET_OUTPUT: 51,
  EVAL_LOOP: 52,
  EVAL: 53,
  ASSERT: 54,

  READ_SLOT: 60,
  READ_BYTES: 61,
  READ_ARRAY: 62,
  READ_HASHED_BYTES: 63,
  READ_SLOTS: 64,

  SET_SLOT: 70,
  ADD_SLOT: 71,
  FOLLOW: 72,

  DUP: 80,
  POP: 81,
  SWAP: 82,

  KECCAK: 90,
  CONCAT: 91,
  SLICE: 92,
  LENGTH: 93,

  PLUS: 100,
  TIMES: 101,
  DIVIDE: 102,
  MOD: 103,
  POW: 104,

  AND: 110,
  OR: 111,
  XOR: 112,
  SHIFT_LEFT: 113,
  SHIFT_RIGHT: 114,
  NOT: 115,

  IS_ZERO: 120,
  EQ: 121,
  LT: 122,
  GT: 123,

  DEBUG: 255,
} as const satisfies Record<string, number>;

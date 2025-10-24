import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const hashPassword = async (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = async (plain: string, hashed: string) => bcrypt.compare(plain, hashed);

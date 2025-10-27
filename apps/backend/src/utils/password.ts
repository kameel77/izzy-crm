import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

export const hashPassword = async (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = async (plain: string, hashed: string) => bcrypt.compare(plain, hashed);

export const generatePassword = (length = 12) => {
  const chars = PASSWORD_ALPHABET;
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars[index];
  }
  return result;
};

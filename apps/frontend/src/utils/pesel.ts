export interface PeselValidationResult {
  valid: boolean;
  birthDate?: Date;
  gender?: "M" | "K";
}

export const validatePESEL = (pesel: string): PeselValidationResult => {
  if (typeof pesel !== "string" || !/^\d{11}$/.test(pesel)) {
    return { valid: false };
  }

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const digits = pesel.split("").map(d => parseInt(d, 10));
  
  const checksum = weights.reduce((sum, weight, i) => sum + weight * digits[i], 0);
  const controlDigit = (10 - (checksum % 10)) % 10;

  if (controlDigit !== digits[10]) {
    return { valid: false };
  }

  let year = 1900 + parseInt(pesel.substring(0, 2), 10);
  let month = parseInt(pesel.substring(2, 4), 10);
  const day = parseInt(pesel.substring(4, 6), 10);

  if (month > 80) {
    year = 1800 + parseInt(pesel.substring(0, 2), 10);
    month -= 80;
  } else if (month > 60) {
    year = 2200 + parseInt(pesel.substring(0, 2), 10);
    month -= 60;
  } else if (month > 40) {
    year = 2100 + parseInt(pesel.substring(0, 2), 10);
    month -= 40;
  } else if (month > 20) {
    year = 2000 + parseInt(pesel.substring(0, 2), 10);
    month -= 20;
  }

  try {
    const birthDate = new Date(Date.UTC(year, month - 1, day));
    if (
      birthDate.getUTCFullYear() !== year ||
      birthDate.getUTCMonth() !== month - 1 ||
      birthDate.getUTCDate() !== day
    ) {
      return { valid: false }; // Invalid date like Feb 30
    }

    if (birthDate > new Date()) {
      return { valid: false }; // Birth date in the future
    }

    const gender = digits[9] % 2 === 0 ? "K" : "M";

    return { valid: true, birthDate, gender };
  } catch (e) {
    return { valid: false };
  }
};

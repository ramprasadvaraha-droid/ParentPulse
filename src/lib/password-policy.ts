import { randomInt } from 'node:crypto';

const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const digits = '23456789';
const specialCharacters = '!@#$%^&*';
const allCharacters = `${letters}${digits}${specialCharacters}`;

export function isValidAccountPassword(password: string) {
  return /^(?=.{8,128}$)(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7e]+$/.test(password);
}

export function generateAccountPassword() {
  const password = [
    letters[randomInt(letters.length)],
    digits[randomInt(digits.length)],
    specialCharacters[randomInt(specialCharacters.length)],
  ];

  while (password.length < 8) password.push(allCharacters[randomInt(allCharacters.length)]);
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  return password.join('');
}
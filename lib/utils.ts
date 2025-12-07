export function staggerDelay(index: number, base = 0.1) {
  return `${index * base}s`;
}

export function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++)
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);

  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++)
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);

  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;

  // Elimina CNPJs invalidos conhecidos
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let size = cnpj.length - 2
  let numbers = cnpj.substring(0, size);
  let digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

export function formatPhoneBr(value: string | number | null | undefined): string {
  const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 11);
  const area = digits.slice(0, 2);
  const lead = digits.slice(2, 3);
  const mid = digits.slice(3, 7);
  const tail = digits.slice(7, 11);

  let result = '';
  if (area) result = `(${area}`;
  if (digits.length >= 2) result += ')';
  if (lead) result += lead;
  if (mid) result += ` ${mid}`;
  if (tail) result += `-${tail}`;
  return result;
}

export function formatCepBr(value: string | number | null | undefined): string {
  const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 8);
  const p1 = digits.slice(0, 5);
  const p2 = digits.slice(5, 8);
  if (!p1) return '';
  return p2 ? `${p1}-${p2}` : p1;
}

export function formatCpfBr(value: string | number | null | undefined): string {
  const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  let result = '';
  if (part1) result = part1;
  if (part2) result += `.${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `-${part4}`;
  return result;
}

export function formatCnpjBr(value: string | number | null | undefined): string {
  const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 14);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);

  let result = '';
  if (p1) result = p1;
  if (p2) result += `.${p2}`;
  if (p3) result += `.${p3}`;
  if (p4) result += `/${p4}`;
  if (p5) result += `-${p5}`;
  return result;
}

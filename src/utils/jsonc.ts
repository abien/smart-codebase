export function stripJsonComments(jsonString: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  
  while (i < jsonString.length) {
    const char = jsonString[i];
    const nextChar = jsonString[i + 1];
    
    if (char === '"' && (i === 0 || jsonString[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }
    
    if (!inString) {
      if (char === '/' && nextChar === '/') {
        while (i < jsonString.length && jsonString[i] !== '\n') {
          i++;
        }
        continue;
      }
      if (char === '/' && nextChar === '*') {
        i += 2;
        while (i < jsonString.length - 1 && !(jsonString[i] === '*' && jsonString[i + 1] === '/')) {
          i++;
        }
        i += 2;
        continue;
      }
    }
    
    result += char;
    i++;
  }
  
  return result;
}

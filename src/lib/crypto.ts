import { NameDisplayMode } from '../types';

/**
 * Hash string with SHA-256
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function formatStudentDisplayName(name: string, mode: NameDisplayMode = 'full'): string {
  if (!name) return '';
  if (mode === 'full') return name;
  if (mode === 'masked') {
    if (name.length <= 1) return name;
    if (name.length === 2) return `${name[0]}*`;
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
  }
  if (mode === 'first_only') {
    if (name.length <= 1) return name;
    return `${name[0]}${'○'.repeat(name.length - 1)}`;
  }
  if (mode === 'initials') {
    // Korean initial consonant extractor
    const CHOSUNG = [
      'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];
    let result = '';
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i) - 44032;
      if (code >= 0 && code <= 11171) {
        result += CHOSUNG[Math.floor(code / 588)];
      } else {
        result += name[i];
      }
    }
    return result;
  }
  return name;
}

export const formatStudentName = formatStudentDisplayName;

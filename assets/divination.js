import { HEXAGRAMS, TRIGRAMS } from './hexagrams.js';

const BEIJING_TIME_ZONE = 'Asia/Shanghai';
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MOVING_LINE_LABELS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const TRIGRAMS_BY_NAME = new Map(TRIGRAMS.map((trigram) => [trigram.name, trigram]));
const HEXAGRAMS_BY_LINES = new Map(HEXAGRAMS.map((hexagram) => [hexagram.lines.join(''), hexagram]));
const HEXAGRAMS_BY_TRIGRAMS = new Map(HEXAGRAMS.map((hexagram) => [`${hexagram.upper}|${hexagram.lower}`, hexagram]));

/** Return a positive remainder in 1..modulus, treating zero as modulus. */
export function normaliseRemainder(value, modulus) {
  const numericValue = Number(value);
  const numericModulus = Number(modulus);
  if (!Number.isInteger(numericValue) || !Number.isInteger(numericModulus) || numericModulus < 1) {
    throw new Error('余数计算参数无效');
  }
  const remainder = ((numericValue % numericModulus) + numericModulus) % numericModulus;
  return remainder === 0 ? numericModulus : remainder;
}

export function trigramFromRemainder(value) {
  const trigram = TRIGRAMS.find((item) => item.remainder === normaliseRemainder(value, 8));
  if (!trigram) throw new Error('八卦余数映射缺失');
  return cloneTrigram(trigram);
}

export function normaliseMovingLine(value) {
  return normaliseRemainder(value, 6);
}

export function hexagramForTrigrams(upper, lower) {
  const upperName = trigramName(upper);
  const lowerName = trigramName(lower);
  const hexagram = HEXAGRAMS_BY_TRIGRAMS.get(`${upperName}|${lowerName}`);
  if (!hexagram) throw new Error(`未找到${upperName}${lowerName}对应卦象`);
  return cloneHexagram(hexagram);
}

export function hexagramForLines(lines) {
  if (!Array.isArray(lines) || lines.length !== 6 || !lines.every((line) => line === 0 || line === 1)) {
    throw new Error('六爻必须是自下而上的六个阴阳值');
  }
  const hexagram = HEXAGRAMS_BY_LINES.get(lines.join(''));
  if (!hexagram) throw new Error('未找到六爻对应卦象');
  return cloneHexagram(hexagram);
}

export function deriveMutualHexagram(lines) {
  return hexagramForLines([...lines.slice(1, 4), ...lines.slice(2, 5)]);
}

export function deriveChangedHexagram(lines, movingLine) {
  const normalisedLine = normaliseMovingLine(movingLine);
  const changed = [...lines];
  if (changed.length !== 6 || !changed.every((line) => line === 0 || line === 1)) {
    throw new Error('变卦需要完整有效的本卦六爻');
  }
  const index = normalisedLine - 1;
  changed[index] = changed[index] === 1 ? 0 : 1;
  return hexagramForLines(changed);
}

/** Read the Chinese lunar calendar and time from a Date in fixed Beijing time. */
export function beijingCalendarParts(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('起卦时间无效');
  let numericParts;
  let chineseParts;
  try {
    numericParts = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
      timeZone: BEIJING_TIME_ZONE,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    chineseParts = new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
      timeZone: BEIJING_TIME_ZONE,
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
  } catch {
    throw new Error('当前浏览器不支持农历起卦');
  }

  const numeric = partMap(numericParts);
  const lunarMonthMatch = /^(\d+)(bis)?$/i.exec(numeric.month || '');
  const lunarMonth = Number(lunarMonthMatch?.[1]);
  const lunarDay = Number(numeric.day);
  const beijingHour = Number(numeric.hour);
  const beijingMinute = Number(numeric.minute);
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12
    || !Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30
    || !Number.isInteger(beijingHour) || beijingHour < 0 || beijingHour > 23
    || !Number.isInteger(beijingMinute) || beijingMinute < 0 || beijingMinute > 59) {
    throw new Error('当前浏览器不支持农历起卦');
  }

  const display = partMap(chineseParts);
  const isLeapMonth = Boolean(lunarMonthMatch?.[2]) || /闰/.test(display.month || '');
  const hourBranch = Math.floor(((beijingHour + 1) % 24) / 2) + 1;
  const hourName = EARTHLY_BRANCHES[hourBranch - 1];
  const lunarLabel = `${isLeapMonth ? '闰' : ''}${lunarMonth}月${lunarDay}日`;
  const timeLabel = `北京时间 ${String(beijingHour).padStart(2, '0')}:${String(beijingMinute).padStart(2, '0')} · ${hourName}时`;
  return { lunarMonth, lunarDay, isLeapMonth, lunarLabel, beijingHour, beijingMinute, hourBranch, hourName, timeLabel };
}

/** Derive the body, mutual, moving, and changed hexagrams from report number + lunar time. */
export function deriveDivination(reportNumber, calendar) {
  const number = Number(reportNumber);
  if (!Number.isInteger(number) || number < 1 || number > 64) throw new Error('报数应为 1 至 64 的整数');
  const safeCalendar = normaliseCalendar(calendar);
  const upper = trigramFromRemainder(number + safeCalendar.lunarMonth + safeCalendar.lunarDay);
  const lower = trigramFromRemainder(number + safeCalendar.hourBranch);
  const movingLine = normaliseMovingLine(number + safeCalendar.lunarMonth + safeCalendar.lunarDay + safeCalendar.hourBranch);
  const primary = hexagramForTrigrams(upper, lower);
  const mutual = deriveMutualHexagram(primary.lines);
  const changed = deriveChangedHexagram(primary.lines, movingLine);
  const movingLineLabel = MOVING_LINE_LABELS[movingLine - 1];
  return {
    calendar: safeCalendar,
    upper,
    lower,
    primary,
    mutual,
    movingLine,
    movingLineLabel,
    changed,
    elements: { upper: upper.element, lower: lower.element },
    formula: `数时合参：${number} + 农历${safeCalendar.lunarLabel} + ${safeCalendar.hourName}时；上卦取数月日，下卦取数时，动爻取合数余六。`,
    transitionCue: `动爻落于${movingLineLabel}，由${primary.name}转为${changed.name}；本次餐签可保留一处调整的余地。`,
  };
}

function cloneTrigram(trigram) {
  return { ...trigram, lines: [...trigram.lines] };
}

function cloneHexagram(hexagram) {
  return { ...hexagram, lines: [...hexagram.lines], reading: { ...hexagram.reading } };
}

function trigramName(value) {
  const name = typeof value === 'string' ? value : value?.name;
  if (!TRIGRAMS_BY_NAME.has(name)) throw new Error('上下卦无效');
  return name;
}

function partMap(parts) {
  return parts.reduce((map, part) => {
    if (part.type !== 'literal' && map[part.type] === undefined) map[part.type] = part.value;
    return map;
  }, {});
}

function normaliseCalendar(calendar) {
  if (!calendar || typeof calendar !== 'object') throw new Error('农历时辰参数无效');
  const lunarMonth = Number(calendar.lunarMonth);
  const lunarDay = Number(calendar.lunarDay);
  const hourBranch = Number(calendar.hourBranch);
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12
    || !Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30
    || !Number.isInteger(hourBranch) || hourBranch < 1 || hourBranch > 12) {
    throw new Error('农历时辰参数无效');
  }
  const hourName = typeof calendar.hourName === 'string' && calendar.hourName ? calendar.hourName : EARTHLY_BRANCHES[hourBranch - 1];
  const lunarLabel = typeof calendar.lunarLabel === 'string' && calendar.lunarLabel ? calendar.lunarLabel : `${calendar.isLeapMonth ? '闰' : ''}${lunarMonth}月${lunarDay}日`;
  const timeLabel = typeof calendar.timeLabel === 'string' && calendar.timeLabel ? calendar.timeLabel : `北京时间 · ${hourName}时`;
  return {
    lunarMonth,
    lunarDay,
    hourBranch,
    hourName,
    lunarLabel,
    timeLabel,
    isLeapMonth: Boolean(calendar.isLeapMonth),
    ...(Number.isInteger(calendar.beijingHour) ? { beijingHour: calendar.beijingHour } : {}),
    ...(Number.isInteger(calendar.beijingMinute) ? { beijingMinute: calendar.beijingMinute } : {}),
  };
}

import { getCollection, type CollectionEntry } from 'astro:content';

export const CATEGORIES = ['提示词', '技术', '工具', '金融', '生活'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Entry = CollectionEntry<'entries'>;

/** 全部已发布条目（过滤 draft），按日期倒序 */
export async function getPublishedEntries(): Promise<Entry[]> {
  const all = await getCollection('entries', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** 「2026年11月10日 星期二」 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

/** 按 YYYY-MM-DD 分组；要求传入已排序数组，保持顺序 */
export function groupByDate(entries: Entry[]): [string, Entry[]][] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.data.date.toISOString().slice(0, 10);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()];
}

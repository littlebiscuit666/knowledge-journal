import rss from '@astrojs/rss';
import { getPublishedEntries } from '../lib/entries';

export async function GET(context) {
  const entries = await getPublishedEntries();
  return rss({
    title: '每日所学',
    description: '记录每天学到的知识',
    site: context.site,
    items: entries.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      link: `/entries/${e.id}/`,
      categories: e.data.tags,
    })),
  });
}

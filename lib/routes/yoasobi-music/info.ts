import { Route } from '@/types';

import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { parseJSONP } from './jsonp-helper';
import { art } from '@/utils/render';
import path from 'node:path';

export const route: Route = {
    path: '/info/:category?',
    categories: ['live'],
    example: '/yoasobi-music/info/news',
    parameters: { category: '`news`, `biography`' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.yoasobi-music.jp/', 'www.yoasobi-music.jp/:category'],
            target: '/info/:category',
        },
    ],
    name: 'News & Biography',
    maintainers: [],
    handler,
    url: 'www.yoasobi-music.jp/',
};

async function handler(ctx) {
    const category = ctx.req.param('category');

    const ARTIST = 'YOASOBI',
        SONYJPURL = 'https://www.sonymusic.co.jp',
        BASEURL = 'https://www.sonymusic.co.jp/json/v2/artist',
        POSTFIX = category === 'news' ? 'start/0/count/-1' : 'start/0/count/-1/callback/hotCallback';

    const officialUrl = `https://www.yoasobi-music.jp/${category}`;
    const api = `${BASEURL}/${ARTIST}/${category === 'news' ? 'information' : 'hottopic'}/${POSTFIX}`;
    const title = `LATEST ${category.toUpperCase()}`;

    const response = await got({
        method: 'get',
        url: api,
    });

    const data = parseJSONP(response.data).items.map((item) => {
        const isBio = category === 'biography';
        const randomEmoji = (() => {
            const emojis = ['㊗️', '🎉', '🎊', '🎈', '🎁', '🎂', '🎀', '🎗', '🎆', '🎇', '🎐', '🎑', '🎃'];
            return emojis[Math.floor(Math.random() * emojis.length)];
        })();

        return {
            id: isBio ? null : item.id,
            guid: isBio ? `bio:${item.url}` : `news:${item.title}${item.date}`,
            title: isBio ? `${randomEmoji} ${item.url}` : item.title,
            category: item.category ?? 'Achievement',
            date: isBio ? item.url : item.date,
            description: isBio ? item.kiji : item.article,
            image: isBio ? (item.image_url === '' ? null : `${SONYJPURL}${item.image_url}`) : null,
        };
    });

    return {
        // the source title
        title,
        // the source url
        link: officialUrl,
        // the source description
        description: `Yoasobi's latest ${category}`,
        // iterate through all leaf objects
        item: data.map((i) => ({
            // the article title
            title: i.title,
            // the article content
            description: art(path.join(__dirname, 'templates/info.art'), {
                image: i.image,
                category: i.category,
                description: i.description.replaceAll('\n', '<br>'),
            }),
            // the article publish time
            pubDate: parseDate(i.date),
            // guid
            guid: i.guid,
            // the article link
            link: i.id ? `${officialUrl}/${i.id}` : officialUrl,
            category: i.category,
        })),
    };
}

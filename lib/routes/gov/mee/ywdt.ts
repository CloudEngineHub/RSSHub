import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const baseUrl = 'https://www.mee.gov.cn/';
const columns = {
    szyw: { name: '时政要闻', order: 1 },
    hjywnews: { name: '环境要闻', order: 2 },
    dfnews: { name: '地方快讯', order: 3 },
    xwfb: { name: '新闻发布', order: 4 },
    spxw: { name: '视频新闻', order: 5 },
    gsgg: { name: '公示公告', order: 6 },
};

export const route: Route = {
    path: '/mee/ywdt/:category?',
    categories: ['government'],
    example: '/gov/mee/ywdt/hjywnews',
    parameters: { category: '分类名，预设 `szyw`' },
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
            source: ['www.mee.gov.cn/ywdt/:category'],
            target: '/mee/ywdt/:category',
        },
    ],
    name: '要闻动态',
    maintainers: ['liuxsdev'],
    handler,
    description: `| 时政要闻 | 环境要闻 | 地方快讯 | 新闻发布 | 视频新闻 | 公示公告 |
| :------: | :------: | :------: | :------: | :------: | :------: |
|   szyw   | hjywnews |  dfnews  |   xwfb   |   spxw   |   gsgg   |`,
};

async function handler(ctx) {
    const cate = ctx.req.param('category') ?? 'szyw';
    const url = `${baseUrl}ywdt/`;
    const title = `${columns[cate].name} - 要闻动态 - 中华人民共和国生态环境部`;
    const response = await got(url);
    const $ = load(response.data);
    const all = $('.bd');
    const list = all
        .find(`div:nth-child(${columns[cate].order})`)
        .find('.mobile_none li , .mobile_clear li')
        .toArray()
        .map((item) => {
            const title = $(item).find('a.cjcx_biaob').text().trim();
            const href = $(item).find('a').attr('href');

            let absolute_path;
            if (href.search(String.raw`\./`) === 0) {
                absolute_path = `${url}${href.slice(2)}`;
            } else if (href.search(String.raw`\./`) === 1) {
                absolute_path = `${baseUrl}${href.slice(3)}`;
            } else {
                absolute_path = href;
            }
            const link = absolute_path;
            return {
                title,
                link,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got(item.link);
                const content = load(detailResponse.data);
                try {
                    item.pubDate = timezone(parseDate(content('meta[name=PubDate]').attr('content')), +8);
                    // 视频新闻规则不一样
                    if (cate === 'spxw') {
                        item.title = content('meta[name=ArticleTitle]').attr('content');
                        // 取消视频自动播放
                        const video_control = content('.neiright_JPZ_GK_CP video');
                        video_control.removeAttr('autoplay');
                        // 视频路径转绝对路径
                        const video_source = content('.neiright_JPZ_GK_CP source');
                        const video_href = video_source.attr('src');
                        const _title_href = item.link.split('/').at(-1);
                        const _video_src = item.link.replace(_title_href, video_href.slice(2));
                        video_source.attr('src', _video_src);
                    }
                    item.description = content('.neiright_JPZ_GK_CP').html();
                } catch {
                    item.description = '';
                }
                return item;
            })
        )
    );

    return {
        title,
        link: url,
        item: items,
    };
}

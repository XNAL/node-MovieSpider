const cheerio = require('cheerio');
const fs = require('fs');

const util =  require('./util');
const setting = require('./setting');

const dataDir = __dirname + '/data/movieData-';
const dataErrDir = __dirname + '/data/movieDataErr-';
const imgPrefix = 'movieImg-';

// 根据网站api得到相应的url和参数
const reqUrl = 'http://movie.mtime.com/boxoffice/';
const reqParams = {
	'year': 2017,
	'area': 'china',
	'type': 'MovieRankingYear',
	'category': 'all',
	'page': 0,
	'display': 'list',
	'timestamp': 1501576013654,
	'version': '07bb781100018dd58eafc3b35d42686804c6df8d',
	'dataType': 'json'
};


let movieData = [],
	movieImgs = [];

// 启动时直接执行代码 
(function spider() {
	util.fetch_data_get(reqUrl, reqParams)
		.then((result) => {
			// 根据页面结构获取总的页数，然后再分页获取数据
			let $ = cheerio.load(result.body.html);
			let pageTotal = $('.bocontent .pagesize a:last-child').data('page') || 0;
			console.log('电影数据总页数：', pageTotal);
			return pageTotal;
		})
		.then((pageTotal) => {
			// 分页获取数据
			getMovieData(0, pageTotal);
		})
		.catch((err) => {
			console.log('获取链接失败：', err);
		})
})();

// 获取电影数据和图片的方法
function getMovieData(pageIndex, pageTotal) {
	reqParams.page = pageIndex;
	util.fetch_data_get(reqUrl, reqParams)
		.then((result) => {
			// 根据页面结构获取所需数据
			let $ = cheerio.load(result.body.html);
			$('.bocontent .boxofficelist dd').each((idx, elem) => {
				$(elem).find('div.movietopmod').each((i, el) => {
					let _this = $(el);
					let arrLeadActor = [];
					_this.find('.txtbox b p').eq(1).find('a').each((idx, ela) => {
						arrLeadActor.push($(ela).text());
					})
					movieData.push({
						rank: _this.find('.picbox i').text(),
						img: _this.find('.picbox img').attr('src').replace(/\/u\//, ""),
						name: _this.find('.txtbox h3').text(),
						director: _this.find('.txtbox b p').eq(0).find('a').text(),
						leadActor: arrLeadActor.join(','),
						point: _this.find('.gradebox .point').text(),
						total: _this.find('.totalbox .totalnum').text()
					}),
					movieImgs.push(_this.find('.picbox img').attr('src').replace(/\/u\//, ""));
				})
			})
			console.log('抓取第', pageIndex, '页的电影数据完毕，目前共 ', movieData.length, '条记录。');
			if(pageIndex <= pageTotal) {
				// 设置timeout防止网站反爬虫导致IP被禁
				setTimeout(() => {
					pageIndex ++;
					getMovieData(pageIndex, pageTotal);
				}, setting.timeout);
			} else {
				console.log('电影数据获取完毕，共 ', movieData.length, '条记录。');
				fs.writeFile(dataDir + reqParams.year + '.json', JSON.stringify(movieData), (err) => {
					if (err) {
						console.log(err);
					} else {
						console.log('数据写入成功');
					}
				});
				let folderName = imgPrefix + reqParams.year;
				util.downloadImg(movieImgs, folderName);
			}
		})
		.catch((err) => {
			console.log('获取电影数据失败：', err);
			fs.writeFile(dataErrDir + reqParams.year + '.json', JSON.stringify(movieData), (err) => {
				if (err) {
					console.log(err);
				} else {
					console.log('写入成功');
				}
			});
		})
}

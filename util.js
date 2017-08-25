const superagent = require('superagent');
const async = require('async');
const path = require('path');
const fs = require('fs');

const setting = require('./setting');
const imgDir = __dirname + '/img/';

function fetch_data_get(url, queryParams) {
	return new Promise((reslove, reject) => {
		superagent
			.get(url)
			.set(setting.header)
			.query(queryParams)
			.end((err, result) => {
				err ? reject(err) : reslove(result);
			})
	})
}

function downloadImg(urls, folderName) {
	async.mapLimit(urls, setting.asyncNum, (img, callback) => {
		fetch_data_get(img, {})
			.then((result) => {
				let fileName = path.basename(img);
				let folder = imgDir + folderName;
				if(!fs.existsSync(folder)) {
					fs.mkdirSync(folder);
				}
				fs.writeFile(folder + '/' + fileName, result.body, (err) => {
					if (err) {
						console.log(img, '图片写入失败：', err);
					} else {
						console.log(img, '图片写入成功');
						callback(null , fileName);
					}
				})
			})
			.catch((err) => console.log(err))
	}, (err, result) => {
		if (err) {
			console.log('图片下载失败：', err)
		} else {
			console.log(result);
		}
	})
}


exports.fetch_data_get = fetch_data_get;
exports.downloadImg = downloadImg;

### 前言

很多程序猿在最开始学习开发的时候应该都有一个想要自己开发一个爬虫的想法（至少我是有的）。所以国内网络上也是爬虫盛行！学了node.js之后发现比较适合写爬虫，不过一直没有动手去写，正好这段时间比较闲，就写个爬虫玩下。

想着爬个什么东西呢？正好都比较喜欢看电影，那就从时光网爬下国内的票房排行榜吧。

### Talk is cheap. Show me the code

[不bb，代码在此](https://github.com/XNAL/node-MovieSpider)

### 如何"食用"

    git clone https://github.com/XNAL/node-MovieSpider
    
    cd node-MovieSpider 

    npm init

    node index.js

### 搭建环境

- 开发语言：[node.js](https://nodejs.org/en/)
- 发出http请求：[superagent](http://visionmedia.github.io/superagent/)
- 并发控制：[async](https://caolan.github.io/async/)
- 分析网页内容：[cheerio](https://github.com/cheeriojs/cheerio)

### 开始撸代码

#### 1. 代码主体

作为一个简单的示例，此次就不开启node服务了，我这里就直接来个自执行的方法。如果有需要，可以根据自己的需求扩展。

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

#### 2. 发送请求

因为代码中需要多次发送http请求，所以把http请求写成一个公共方法会比较好。使用上面提到`superagent`库来实现。

    // 公共方法：通过get请求获取数据
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

#### 3. 分析目标网站api

根据人工操作得来的api`http://movie.mtime.com/boxoffice/?year=2017&area=china&type=MovieRankingYear&category=all&page=0&display=list&timestamp=1505818638620&version=07bb781100018dd58eafc3b35d42686804c6df8d&dataType=json`可以得到以下参数：

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

因为此次要获取的是`2017年内地票房排行榜`。根据分析可知：需要变动的主要是`page`参数，那这里就需要根据页面返回的内容来取得总的`page`。

#### 4. 使用cheerio获取所需参数

api返回的页面内容可查看：[将api获取的数据格式化后的页面代码](https://github.com/XNAL/node-MovieSpider/blob/master/time.html)。

这里需要用到`cheerio`来取页码总数的代码，`cheerio`可以理解为服务器端的jQuery，用法也类似：

    // 根据页面结构获取总的页数，然后再分页获取数据
    let $ = cheerio.load(result.body.html);
    let pageTotal = $('.bocontent .pagesize a:last-child').data('page') || 0;

#### 5. 开始分页取目标数据

<1> 调用上面所说的公共方法`fetch_data_get`获取数据，然后取页面内容，图片地址都先保存在`movieImgs`中，最后再统一下载图片：

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

<2> 根据页码循环取数据

    if(pageIndex <= pageTotal) {
        // 设置timeout防止网站反爬虫
        setTimeout(() => {
            pageIndex ++;
            getMovieData(pageIndex, pageTotal);
        }, setting.timeout);
    } 

<3> 全部数据取出后存储数据，并下载图片。

因为只是一个简单的示例，所以此次数据只是保存到`json`文件中。如果需要对数据进行后续操作的话，那就最好保存到数据库中：

    fs.writeFile(dataDir + reqParams.year + '.json', JSON.stringify(movieData), (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('数据写入成功');
        }
    });

调用下载图片的方法：

    let folderName = imgPrefix + reqParams.year;
    util.downloadImg(movieImgs, folderName);

`util.js`中的`downloadImg`方法：这里就需要用到上面所说的`async`，使用`async`是为了进行并发控制，不然极短时间发送至少几十几百次的请求，这种情况弄不好就被网站的发爬虫程序给封了，而且大量并发也会导致出错的概率更高。

    // 异步下载图片
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

### 结语

到此为止一个简单的node.js版的小爬虫就开发完成了。其实弄懂了爬虫的原理，再回过头去看，发现开发一个简单的爬虫来说还是很容易的。

最后，欢迎大家去[我的github](https://github.com/XNAL)进行`star`和`fork`。
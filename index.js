const fs = require("fs");
const readline = require('readline');
const cheerio = require("cheerio");
const csvWriter = require('csv-write-stream')

let writer = csvWriter({
    seperator : '|'
})

writer.pipe(fs.createWriteStream('data.csv'))

const getProducts = async (page) => {
    let $ = cheerio.load(page)
    return $("div.title a").map((i, anchorTag) => $(anchorTag).attr('href')).toArray()
}

const getProductDetails = async (links)=>{
    for (let index = 0; index < links.length; index++) {
        let productURL = links[index]
        const productUrlPage = await fetch(productURL);
        let $ = cheerio.load(await productUrlPage.text())
        let productName = $("h2.custom-color").text()
        let manufacturerPartNumber = $(".marginM > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)").text()
        let vendor = $(".marginM > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2)").text()
        let description = $("#description").text()
        let images = []
        $(".marginMobile").map((i,div)=>{
            let imageSrc = $(div).children('img').attr('src')
            if(imageSrc)
                images.push(imageSrc)    
        })

        let specifications = []
        let table = $("table.table:nth-child(1)")
        let keyProperty = ''
        table.find('tr').each((i,tr)=>{
           $(tr).find('td').each((i,td)=>{
                if(i == 0){
                    keyProperty = $(td).text()
                }else{
                        specifications.push({key : `${keyProperty}`,value : $(td).text()})
                }
           })
        })

        

        let alternativeProducts = []
        for (let index = 0; index < 4; index++) {
            let sku = $(`div.col-md-3:nth-child(${index+1}) > div:nth-child(1) > h2:nth-child(3)`)
            alternativeProducts.push((sku.text()))
        }


        
        writer.write({name: productName, manufacturerPartNumber, vendor, description, images : JSON.stringify(images), specifications : JSON.stringify(specifications) , alternativeProducts : JSON.stringify(alternativeProducts),url:links[index]})

    }
}


const getNextPage = async (link, pageNumber) =>{
    link = link+`&page=${pageNumber}`
    let page = await fetch(link);
    return await page.text();
}


(async ()=>{

    const categoriesURLs = fs.createReadStream('categoriesURLs.txt');
    const categoriesURLsInterface = readline.createInterface({
        input: categoriesURLs,
        crlfDelay: Infinity
    });
    for await (const categoryURL of categoriesURLsInterface) {
        if(categoryURL){
            const categoryUrlPage = await fetch(categoryURL);
            let $ = cheerio.load(await categoryUrlPage.text());
            let startPage = 1
            let totalPages
            if(categoryURL.split('=').length > 2){
                startPage = categoryURL.split('=')[categoryURL.split('=').length - 1]
                totalPages = $(".pagination > li:nth-child(13) > a:nth-child(1)").text()
            }else{
                totalPages = $(".pagination > li:nth-child(11) > a:nth-child(1)").text()
            }

            
            for (let index = Number(startPage); index <= Number(totalPages); index++) {
                
                let page = await getNextPage(categoryURL, index)
                await getProductDetails(await getProducts(page))

            }
        }
    }

})()

const puppeteer = require("puppeteer");

module.exports = class SkillScraper {


    constructor(skillPagePath, pathDelimiter) {
        this._delimiter = pathDelimiter;
        this._skillPagePath = skillPagePath;
    }


    getSkills() {
        return this._skills;
    }

    async init() {
        this._browser = await puppeteer.launch();
        this._skills = await this._getSkills();
    }

    async scrapeSkill(skillName) {
        let data = null;
        switch (skillName) {
            case "Mining":
                data = await this._scrapeMiningData(this._skills[skillName].skillPage);
                break;
            case "Fishing":
                data = await this._scrapeFishingData(this._skills[skillName].skillPage);
                break;
        }
        return data;
    }

    async _getSkills() {

        let skills = {};
        let page = await this._browser.newPage();
        await page.goto(this._skillPagePath);
        let skillAreas = await page.$$("#skillslayoutlarge area");
        // console.log(skillAreas);
        for(let area of skillAreas) {
            let skillPathEle = await area.getProperty("href");
            let skillPath = await skillPathEle.jsonValue();
            // console.log(skillPath);
            let skillName = skillPath.substring(skillPath.indexOf(this._delimiter) + this._delimiter.length);
            let d = this._delimiter;
            let spp = this._skillPagePath;
            if (!skills.hasOwnProperty(skillName)) {
                skills[skillName] = { skillPage: skillPath };
            }
        };
        return skills;
    }

    async _getPage(url) {
        let page = await this._browser.newPage();
        await page.goto(url);
        return page;
    }

    async _scrapeMiningData(miningSkillPath) {
        let page = await this._getPage(miningSkillPath);

        let miningData = { tools: {}, resources: [] };
        miningData.tools = await this._scrapeToolTable(miningSkillPath, page);
        miningData.resources = await this._scrapeResourceTable(miningSkillPath, page);

        return miningData;
    }

    async _scrapeFishingData(fishingSkillPath) {
        let fishingData = { tools: {}, fish: [] };
        console.log("FishingPage", fishingSkillPath);
        let page = await this._getPage(fishingSkillPath);

        fishingData.tools = await this._scrapeToolTable(fishingSkillPath, page);
        fishingData.fish = await this._scrapeFishTable(fishingSkillPath, page);
        return fishingData;
    }

    async _scrapeToolTable(pagePath, page) {
        //Get tool data
        let toolData = {};
        let levels = [];
        let [toolTable] = await page.$x("//*[@id = \"Tools\"]/../following-sibling::table[@class=\"wikitable\"]");
        let rows = await toolTable.$$("tr");
        for( let th of await rows[1].$$("th")) {
            let a = await th.$("a");
            let img;
            if(a != null ) {
                img = await a.$("img");
            }
            else {
                img = await th.$("img");
            }

            let name = await (await img.getProperty("alt")).jsonValue()
            let imgPath = await (await img.getProperty("src")).jsonValue()
            levels.push({ skillName: name, skillImg: imgPath, link: pagePath.substring(0, pagePath.indexOf(this._delimiter) + this._delimiter.length) + name });
        }

        for (let i = 2; i < rows.length; i++) {

            let toolName = "";
            let tds = await rows[i].$$("td");
            for(let idx = 0; idx < tds.length; idx++ ) {
                let td = tds[idx];
                if(idx == 0) {
                    let a = await td.$("a");
                    toolName = await ( await a.getProperty("title")).jsonValue();
                    if(!toolData.hasOwnProperty(toolName)) {
                        toolData[toolName] = { requirements: {}};
                    }
                }
                else {
                    let level = levels[idx -1];
                    if(!toolData[toolName].requirements.hasOwnProperty(level.skillName)) {
                        let l = await td.evaluate(node => node.innerText);
                        toolData[toolName].requirements[level.skillName] = {level: l, skillImg: level.skillImg, link: level.link};
                    }
                }
            }
        }

        return toolData;
    }

    async _scrapeResourceTable(pagePath, page) {
        //Get Resource data
        let resources = [];
        let [resourceTable] = await page.$x("//*[@id = \"Resources\"]/../following-sibling::table[@class=\"wikitable\"]");
        //console.log("resourceTable", resourceTable);
        let rows = await resourceTable.$$("tr");
        rows.shift(); // throw away the header row
        for( let tr of rows) {
            let resourceData = { requirements: {}, name: "", img: "", link: "", xp : 0};
            let tds = await tr.$$("td");
            for( let i = 0; i < tds.length; i++ ) {
                let td = tds[i];
                if(i == 0) { // LEVEL
                    let skillLevel = (await td.evaluate(node => node.innerText)).trim();
                    let img = await td.$("img");
                    let skillName = await ( await img.getProperty("title")).jsonValue();
                    let skillImg = await (await img.getProperty("src")).jsonValue();
                    if(!resourceData.requirements.hasOwnProperty(skillName)) {
                        resourceData.requirements[skillName] = {level: skillLevel, img: skillImg};
                    }
                }
                else if( i == 1 ) { // Resource Info
                    let a = await td.$("a");
                    if(a != null) {
                        let img = await a.$("img");
                        if(img != null ) {
                            let imgPath = await img.getProperty("src");
                            resourceData.img = await imgPath.jsonValue();
                        }
                        let resourceLink = await a.getProperty("href");
                        let resourceName = await a.getProperty("title");
                        resourceData.name = await resourceName.jsonValue();
                        resourceData.link = await resourceLink.jsonValue();
                    }
                }
                else { // XP
                    resourceData.xp = await td.evaluate(node => node.innerText.trim())
                }
            }
            resources.push(resourceData);
        }

        return resources;
    }

    async _scrapeFishTable(pagePath, page) {
        let fish = [];
        let [resourceTable] = await page.$x("//*[@id = \"Fish\"]/../following-sibling::table[@class=\"wikitable\"]");
        //console.log("resourceTable", resourceTable);
        let rows = await resourceTable.$$("tr");
        rows.shift(); // throw away the header row
        for(let tr of rows) {
            let fishData = { requirements: {}, bait: null, name: "", img: "", link: "", tool: {}, xp: 0 };
            let tds = await tr.$$("td");

            for(let i = 0; i < tds.length; i++ ) {
                let td = tds[i];

                if (i == 0) { // level
                    let skillLevel = await td.evaluate(node => node.innerText.trim());
                    let img = await td.$("img");
                    let skillName = await ( await img.getProperty("title")).jsonValue();
                    let skillImg = img != null ? await ( await img.getProperty("src")).jsonValue() : "";
                    if (!fishData.requirements.hasOwnProperty(skillName)) {
                        fishData.requirements[skillName] = { level: skillLevel, img: skillImg };
                    }
                } else if (i == 1) { // Fish Info
                    let a = await td.$("a");
                    if (a != null) {
                        let img = await a.$("img");
                        if( img != null) {
                            let imgPath = await ( await img.getProperty("src")).jsonValue();
                            fishData.img = imgPath;
                        }
                        let resourceLink = await a.getProperty("href");
                        fishData.name = await ( await a.getProperty("title")).jsonValue();
                        fishData.link = await resourceLink.jsonValue();
                    }
                } else if (i == 2) { // XP
                    fishData.xp = await td.evaluate(node => node.innerText.trim());
                } else if (i == 3) { //Tool Info
                    let a = await td.$("a");
                    if (a != null) {
                        let img = await a.$("img");
                        let toolName = await ( await img.getProperty("title")).jsonValue();
                        let imgPath = img != null ? await ( await img.getProperty("src")).jsonValue() : "";
                        let toolLink = await ( await a.getProperty("href")).jsonValue();
                        if (!fishData.tool.hasOwnProperty(toolName)) {
                            fishData.tool[toolName] = { img: imgPath, link: toolLink }
                        }
                    }
                } else if (i == 4) { // Bait Info
                    let a = await td.$("a");
                    if (a != null) {
                        if (fishData.bait == null) {
                            fishData.bait = {};
                        }
                        let img = await a.$("img");
                        let baitName = await ( await img.getProperty("title")).jsonValue();
                        let imgPath = img != null ? await ( await img.getProperty("src")).jsonValue() : "";
                        let baitLink = await ( await a.getProperty("href")).jsonValue();
                        if (!fishData.bait.hasOwnProperty(baitName)) {
                            fishData.bait[baitName] = { img: imgPath, link: baitLink }
                        }
                    }
                }
            }
            fish.push(fishData);
        }

        return fish;
    }
}
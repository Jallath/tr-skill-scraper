
const SkillScraper = require("./skillscraper");

async function scrapeSkills(url) {

    let scraper = new SkillScraper(url, "/w/");
    await scraper.init();
    let skills = await scraper.getSkills();
    //console.log(skills);

    let miningData = await scraper.scrapeSkill("Mining");
    let fishingData = await scraper.scrapeSkill("Fishing");

    console.log("Mining Data",miningData);
    console.log("Fishing Data", fishingData);
}

scrapeSkills("https://titanreach.wiki/w/Skills");
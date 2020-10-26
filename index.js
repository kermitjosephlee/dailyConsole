// const dotenv = require("dotenv").config()
// const express = require("express")
// const app = express()
// const port = 8000
const axios = require("axios");
const { toJson } = require("xml2json");
const dropRight = require("lodash/dropRight");
const startCase = require("lodash/startCase");
const shuffle = require("lodash/shuffle");
// const first = require("lodash/first")
const differenceInDays = require("date-fns/differenceInDays");
const format = require("date-fns/format");
const chalk = require("chalk");
const Table = require("cli-table3");
// const smartcar = require("smartcar")

// app.set("view engine", "ejs")
// app.use(express.static("public"))

const covidApiUrl = "https://data.ontario.ca/api/3/action/datastore_search?resource_id=ed270bb8-340b-41f9-a7c6-e8ef587e6d11&offset=200"
const weatherApiUrl = "https://dd.weather.gc.ca/citypage_weather/xml/ON/s0000458_e.xml"
const cbcNewsApiUrl = "https://www.cbc.ca/cmlink/rss-topstories?feed=mobile"
const nyTimesNewsApiUrl = "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
const bbcNewsApiUrl = "http://feeds.bbci.co.uk/news/world/rss.xml"

const covidAPI = axios
  .get(covidApiUrl)
  .then((response) => covidRecordsProcessor(response.data.result.records))
  .catch((err) => console.log(err));

const weatherApi = axios
  .get(weatherApiUrl)
  .then(({ data }) => {
    return toJson(data, {
      object: true,
      reversible: false,
      coerce: true,
      sanitize: true,
      trim: false,
      arrayNotation: false,
    });
  })
  .then((data) => data.siteData)
  .catch((err) => console.log(err));

const cbcNewsApi = axios
  .get(cbcNewsApiUrl)
  .then(({ data }) => {
    const jsonPackage = toJson(data, {
      object: true,
      reversible: false,
      coerce: true,
      sanitize: true,
      trim: false,
      arrayNotation: false,
    });

    return jsonPackage.rss.channel.item.map((story) => story.title);
  })
  .catch((err) => console.log(err));

const nyTimesNewsApi = axios
  .get(nyTimesNewsApiUrl)
  .then(({data}) => {
    const jsonPackage = toJson(data, {
      object: true,
      reversible: false,
      coerce: true,
      sanitize: true,
      trim: false,
      arrayNotation: false,
    });

    return jsonPackage.rss.channel.item.map((story) => story.title)
    
  })
  .catch((err) => console.log(err))

  const bbcNewsApi = axios
  .get(bbcNewsApiUrl)
  .then(({data}) => {
    const jsonPackage = toJson(data, {
      object: true,
      reversible: false,
      coerce: true,
      sanitize: true,
      trim: false,
      arrayNotation: false,
    });

    return jsonPackage.rss.channel.item.map((story) => story.title)
    
  })
  .catch((err) => console.log(err))

Promise.all([covidAPI, weatherApi, cbcNewsApi, nyTimesNewsApi, bbcNewsApi])
  .then(([covid, weather, cbcNews, nyTimesNews, bbcNews]) => {
    resultsPresenter(covid, weather, cbcNews, nyTimesNews, bbcNews);
  })
  .catch((err) => console.log(err));

// *** Odometer Utility *** ==================================

const annualAllowance = 20000;
const daysPerYear = 365;
const dailyAllowance = annualAllowance / daysPerYear;

const today = new Date();
const startDateLease = new Date("July 7, 2020");

const daysSinceStartLease = differenceInDays(today, startDateLease);
const currentOdometerLimit = dailyAllowance * daysSinceStartLease;

// const smartcarClient = new smartcar.AuthClient({
//   clientId: process.env.SMARTCAR_CLIENT_ID,
//   clientSecret: process.env.SMARTCAR_CLIENT_SECRET,
//   redirectUri: "localhost:8000",
//   scope: ["required: read_vehicle_info"],
//   testMode: true,
// })

// const authUrl = smartcarClient.getAuthUrl()

// app.get("/", (req, res) => {
//   res.render("home/index", {
//     url: authUrl,
//   })
// })

// app.get("/home", (req, res) => {
//   res.send("home")
// })

// axios.get(authUrl).then(data => console.log(data)).catch(error => console.log(error))

// *** Covid Utility *** ==================================

const startDateCovid = new Date("March 11, 2020");
const daysSinceStartCovid = differenceInDays(today, startDateCovid);

const covidRecordsProcessor = (records) => {
  const descendingRecordsArray = records.reverse();
  return dropRight(descendingRecordsArray, descendingRecordsArray.length - 10);
};

const newCasesArrayMaker = (records) => {
  const returnArray = records.map((record, index) => {
    if (index + 1 === records.length) return null;
    return {
      date: record["Reported Date"],
      totalCases: record["Total Cases"],
      newCases: record["Total Cases"] - records[index + 1]["Total Cases"],
    };
  });

  return dropRight(returnArray, 1);
};

// *** Weather Utility *** ==================================

const weatherDataProcessor = (weather) => {
  const { currentConditions, forecastGroup } = weather;
  const returnObj = {
    current: {
      state: currentConditions.condition,
      temperature: currentConditions.temperature,
      humidex: currentConditions.humidex,
      humidity: currentConditions.relativeHumidity,
    },
    forecast: forecastGroup.forecast,
  };

  return returnObj;
};

// *** Display *** ==================================

const resultsPresenter = (records, weather, cbcNews, nyTimesNews, bbcNews) => {
  const table = new Table();
  const shuffledCbcNews = shuffle(cbcNews);
  const shuffledNyTimesNews = shuffle(nyTimesNews)
  const shuffledBbcNews = shuffle(bbcNews)

  const newCasesArray = newCasesArrayMaker(records);
  const newCasesNumerator = parseInt(
    newCasesArray.map((record) => record.newCases).reduce((a, c) => a + c),
    10
  );
  const newCasesAverage = parseInt(
    newCasesNumerator / newCasesArray.length,
    10
  );

  const displayDailyNewCases = () => {
    const newCases = newCasesArray[0].newCases;
    if (newCases > newCasesAverage) return chalk.redBright(newCases);
    if (newCases < newCasesAverage) return chalk.greenBright(newCases);
    return chalk.yellowBright(newCases);
  };

  const displayTrend = () => {
    const newCases = newCasesArray[0].newCases;
    if (newCases > newCasesAverage)
      return chalk.redBright(
        `${String.fromCharCode(0x2191)}${String.fromCharCode(
          0x2191
        )}${String.fromCharCode(0x2191)}`
      );
    if (newCases < newCasesAverage)
      return chalk.greenBright(
        `${String.fromCharCode(0x2193)}${String.fromCharCode(
          0x2193
        )}${String.fromCharCode(0x2193)}`
      );
    return chalk.yellowBright("---");
  };

  const highLowStyler = (status) => {
    if (status === "high") return chalk.redBright(startCase(status));
    if (status === "low") return chalk.cyan(startCase(status));
    return chalk.yellow(startCase(status));
  };

  const weatherPackage = weatherDataProcessor(weather);

  const currentWeatherPresenter = (current) => {
    const { state, temperature, humidex, humidity } = current;
    const humidexStyler = (humidex) => {
      if (!humidex) return "";
      return ` // ${humidex["$t"]}${String.fromCharCode(0x00b0)}${
        temperature.units
      } hmdx`;
    };
    return [
      chalk.dim("Current"),
      { hAlign: "right", content: state },
      `${temperature["$t"]}${String.fromCharCode(0x00b0)}${
        temperature.units
      }${humidexStyler(humidex)}`,
      `  ${humidity["$t"]}${humidity.units} ${chalk.dim("humidity")} `,
    ];
  };

  const forecastPresenter = (forecast) => {
    const { period, abbreviatedForecast, temperatures } = forecast;

    const probabiltyOfPrecipitationStyler = (pop) => {
      if (!pop["$t"]) return `0% ${chalk.dim("chance")}`;
      return `${pop["$t"]}${pop.units} ${chalk.dim("chance")}`;
    };

    return [
      `${chalk.dim(period.textForecastName)}`,
      { hAlign: "right", content: abbreviatedForecast.textSummary },
      `${highLowStyler(temperatures.temperature.class)} ${
        temperatures.temperature["$t"]
      }${String.fromCharCode(0x00b0)}${temperatures.temperature.units}  `,
      `  ${probabiltyOfPrecipitationStyler(abbreviatedForecast.pop)}`,
    ];
  };

  const newsPresenter = (news) => {
    return [{ colSpan: 4, content: chalk.dim(`- ${news}`) }];
  };

  const highlightYellow = (string) => {
    return chalk.yellowBright(string)
  }

  const blankRow = (title = "") => {
    return [{ colSpan: 4, content: title }];
  };

  table.push(
    [
      chalk.dim("Today's Date"),
      format(today, "EEE MMM dd, yyyy"),
      { hAlign: "right", content: displayDailyNewCases() },
      chalk.dim(
        `New Cases: ${format(new Date(newCasesArray[0].date), "MMM dd")}`
      ),
    ],
    [
      chalk.dim("Days Since Covid Start"),
      `${highlightYellow(daysSinceStartCovid)} days`,
      { hAlign: "right", content: chalk.cyanBright(newCasesAverage) },
      chalk.dim("10-day Average"),
    ],
    [
      chalk.dim("Current Odometer Limit"),
      `${highlightYellow(parseInt(currentOdometerLimit, 10))} km // ${highlightYellow(daysSinceStartLease)} days`,
      { hAlign: "right", content: displayTrend() },
      chalk.dim(`Trend`),
    ],
    blankRow(),
    currentWeatherPresenter(weatherPackage.current),
    forecastPresenter(weatherPackage.forecast[0]),
    forecastPresenter(weatherPackage.forecast[1]),
    forecastPresenter(weatherPackage.forecast[2]),
    blankRow(),
    blankRow("CBC News"),
    newsPresenter(shuffledCbcNews[0]),
    newsPresenter(shuffledCbcNews[1]),
    newsPresenter(shuffledCbcNews[2]),
    blankRow("NY Times"),
    newsPresenter(shuffledNyTimesNews[0]),
    newsPresenter(shuffledNyTimesNews[1]),
    newsPresenter(shuffledNyTimesNews[2]),
    blankRow("BBC Times"),
    newsPresenter(shuffledBbcNews[0]),
    newsPresenter(shuffledBbcNews[1]),
    newsPresenter(shuffledBbcNews[2]),
  );

  console.log(table.toString());
  // app.listen(port, () => {
  //   console.log(`Listening on port ${port}`)
  // })
};

const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

// Set view engine to EJS
app.set("view engine", "ejs");

// user res.render to load ejs view file
app.get("/", (req, res) => {
  res.render("pages/index", { forecastMessage: forecastMessage });
});

app.listen(process.env.PORT || port, () =>
  console.log(`Listening on port ${port}`)
);

// Access hidden files in the .env file
require("dotenv").config();

// GLOBAL & ENV VARS
const accuWeatherAPIKey = `${process.env.AW_API_KEY}`;
const accuWeatherLocationKey = `${process.env.AW_LOCATION_KEY}`;
const clickUpAPIKey = `${process.env.CLICKUP_API_KEY}`;
const clickupListID = `${process.env.CLICKUP_LIST_ID}`;
const accuWeatherForecastURL = `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${accuWeatherLocationKey}?apikey=${accuWeatherAPIKey}`;
const clickupURL = "https://api.clickup.com/api/v2";
let forecastMessage = "Awaiting forecast";

/**
 * Calls a function at a specific time of day
 * Source: https://gist.github.com/farhad-taran/f487a07c16fd53ee08a12a90cdaea082
 * @param {q} hour
 * @param {*} minutes
 * @param {*} func
 */
function runAtTimeOfDay(hour, minutes, func) {
  const twentyFourHours = 86400000;
  const now = new Date();
  let timeInMilliseconds =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minutes,
      0,
      0
    ).getTime() - now;
  if (timeInMilliseconds < 0) {
    timeInMilliseconds += twentyFourHours;
  }
  setTimeout(function () {
    //run once
    func();

    // run every 24 hours from now on
    setInterval(func, twentyFourHours);
  }, timeInMilliseconds);
}

// GET ACCUWEATHER DATA
async function getAccuWeatherForecastData() {
  const forecast = await fetch(accuWeatherForecastURL).then((res) =>
    res.json()
  );

  /**
   *
   * @param {*} forecastArr
   * @returns the first forecast object where the PrecipitationProbability prop is greater than 30(%)
   */
  function precipitationLikely(forecastArr) {
    return forecastArr.find(
      (forecastObj) => forecastObj.PrecipitationProbability > 30
    );
  }

  return await precipitationLikely(forecast);
}

// CREATES THE CU TASK
async function createCUTask(forecastFunc) {
  try {
    // Declare and initialize vars dependent on precipitation data
    let precipitativeForecastObject = await forecastFunc();
    let precipitationProbability =
      precipitativeForecastObject.PrecipitationProbability;
    let dateTimePrecipitationExpected = precipitativeForecastObject.DateTime;

    // Declare and initalize precip and standard dates for use later
    let precipDateObject = new Date(dateTimePrecipitationExpected);
    let standardDateObject = new Date();
    dateTimePrecipitationExpected = precipDateObject.toLocaleString("en-US", {
      timeZone: "America/New_York",
    });

    // Returns a human-readable time string
    function getPrecipitationTime(dateTimeString) {
      let result = "";
      let dateTimeArr = dateTimeString.split(" ");
      dateTimeArr.shift();
      result = dateTimeArr.join(" ");
      return (result = result.slice(0, 2) + " " + result.slice(-2));
    }

    // Get the precipitation time (to be used in task description)
    let timePrecipitationExpected = getPrecipitationTime(
      dateTimePrecipitationExpected
    );

    // Headers
    let myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", clickUpAPIKey);

    /*
        Calculate the task due date
        Using the Date object, get today's date and time, remove any decimals, and convert to unix millisecond figure
    */

    let dueDate =
      parseInt((standardDateObject.getTime() / 1000).toFixed(0)) * 1000;

    // Request Body
    let raw = JSON.stringify({
      name: "Cover the firewood",
      description: `The chance of precipitation is ${precipitationProbability}% at ${timePrecipitationExpected}. Make sure you cover the firewood today.`,
      assignees: [44411049],
      tags: ["accuweather-app"],
      status: "To Do",
      priority: 2,
      due_date: dueDate,
      due_date_time: false,
      start_date_time: false,
      notify_all: true,
    });

    // Options
    let requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    // Send POST request to create task
    const clickUpTaskData = await fetch(
      `${clickupURL}/list/${clickupListID}/task`,
      requestOptions
    )
      .then((res) => res.json())
      .then((result) => console.log(result))
      .catch((err) => console.log(err));

    // Finally, assing the forecast message variable
    forecastMessage = `The chance of precipitation is ${precipitationProbability}% at ${timePrecipitationExpected}. Make sure you cover the firewood today.`;

    return clickUpTaskData;

    /**
     * If precipitationLikely returns undefined,
     * it most likely means that there is no forecast in the next twelve hours that meets the >30% chance precip criteria.
     * In these cases, a TypeError is thrown because Node can't read any props of precipitativeForecast.undefined.
     * We want to handle this case by printing the message to the console and keeping the program running.
     */
  } catch (error) {
    if (error.message.includes("PrecipitationProbability")) {
      forecastMessage =
        "Very low chance of precipitation for the next twelve hours";
      console.log(forecastMessage);
    } else {
      console.log(error);
    }
  }
}

// Returns a call to fetch the endpoints
async function start() {
  return await createCUTask(getAccuWeatherForecastData);
}

// Call the function every twenty-four hours starting at a specific time
runAtTimeOfDay(07, 00, start);

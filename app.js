const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Set view engine to EJS
app.set("view engine", "ejs");

// user res.render to load ejs view file
app.get("/", (req, res) => {
  res.render("pages/index");
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// Access hidden files in the .env file
require("dotenv").config();

// GLOBAL & ENV VARS
const accuWeatherAPIKey = `${process.env.AW_API_KEY}`;
const accuWeatherLocationKey = `${process.env.AW_LOCATION_KEY}`;
const clickUpAPIKey = `${process.env.CLICKUP_API_KEY}`;
const clickupListID = `${process.env.CLICKUP_LIST_ID}`;
const accuWeatherForecastURL = `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${accuWeatherLocationKey}?apikey=${accuWeatherAPIKey}`;
const clickupURL = "https://api.clickup.com/api/v2";

/**
 * Calls a function at a specific time of day
 * Source: https://gist.github.com/farhad-taran/f487a07c16fd53ee08a12a90cdaea082
 * @param {q} hour
 * @param {*} minutes
 * @param {*} func
 */
function runAtSpecificTimeOfDay(hour, minutes, func) {
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

// MAKES THE API CALLS
async function getAccuWeatherForecastDataAndCreateCUTask() {
  // GET ACCUWEATHER DATA
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

  // Code to run given that there is a forecast object returned from precipitationLikely
  try {
    // VARIABLES DEPENDENT ON PRECIPITATION CHANCES
    let precipitativeForecast = precipitationLikely(forecast);
    let precipitationProbability =
      precipitativeForecast.PrecipitationProbability;
    let dateTimePrecipitationExpected = precipitativeForecast.DateTime;

    // CU VARIABLES
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

    // GET THE PRECIPITATION TIME FOR TASK DESCRIPTION
    let timePrecipitationExpected = getPrecipitationTime(
      dateTimePrecipitationExpected
    );

    // CU HEADERS
    let myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", clickUpAPIKey);

    /* 
        CALCULATE THE TASK DUE DATE
        Using the Date object, get today's date and time, remove any decimals, and convert to unix millisecond figure
        Source: https://stackoverflow.com/questions/11893083/convert-normal-date-to-unix-timestamp
    */

    let dueDate =
      parseInt((standardDateObject.getTime() / 1000).toFixed(0)) * 1000;

    // CU JSON
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

      // TO-DO: set to true before testing on mobile
      notify_all: false,
    });

    // CU REQUEST
    let requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    // CU PROMISE
    const clickUpTaskData = await fetch(
      `${clickupURL}/list/${clickupListID}/task`,
      requestOptions
    )
      .then((res) => res.json())
      .then((data) => console.log(data))
      .catch((err) => console.log(err));

    /**
     * If precipitationLikely returns undefined,
     * it most likely means that there is no forecast in the next twelve hours that meets the >30% chance precip criteria.
     * In these cases, a TypeError is thrown because Node can't read any props of precipitativeForecast.undefined.
     * We want to handle this case by printing the message to the console and keeping the program running.
     */
  } catch (error) {
    if (error instanceof TypeError) {
      console.log("Very low chance of precipitation for the next twelve hours");
    } else {
      console.log(error);
    }
  }
}

// Call the function every twenty-four hours starting at a specific time
runAtSpecificTimeOfDay(09, 31, getAccuWeatherForecastDataAndCreateCUTask);

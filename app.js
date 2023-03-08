// Access hidden files in the .env file
require("dotenv").config();

const accuWeatherAPIKey = `${process.env.AW_API_KEY}`;
const accuWeatherLocationKey = `${process.env.AW_LOCATION_KEY}`;
const clickUpAPIKey = `${process.env.CLICKUP_API_KEY}`;
const clickupListID = `${process.env.CLICKUP_LIST_ID}`;
const accuWeatherForecastURL = `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${accuWeatherLocationKey}?apikey=${accuWeatherAPIKey}`;

// Source: https://gist.github.com/farhad-taran/f487a07c16fd53ee08a12a90cdaea082
function runAtSpecificTimeOfDay(hour, minutes, func) {
  const twelveHours = 43200000;
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
    timeInMilliseconds += twelveHours;
  }
  setTimeout(function () {
    //run once
    func();

    // run every 12 hours from now on
    setInterval(func, twelveHours);
  }, timeInMilliseconds);
}

// Call the function every twelve hours starting at 7:01
runAtSpecificTimeOfDay(07, 01, getAccuWeatherForecastDataAndCreateCUTask);

async function getAccuWeatherForecastDataAndCreateCUTask() {
  // ACCUWEATHER DATA
  const forecast = await fetch(accuWeatherForecastURL).then((res) =>
    res.json()
  );

  let twelfthHourForecast = forecast[forecast.length - 1];
  let precipitationProbability = twelfthHourForecast.PrecipitationProbability;

  if (precipitationProbability < 30) {
    process.exit();
  } else {
    // CU Vars
    let clickupURL = "https://api.clickup.com/api/v2";
    let today = new Date();
    let todaysDate = today.toDateString();

    // Using the Date object, get today's date and time, remove any decimals, and convert to unix millisecond figure
    // Source: https://stackoverflow.com/questions/11893083/convert-normal-date-to-unix-timestamp
    let dueDate = parseInt((today.getTime() / 1000).toFixed(0)) * 1000;

    // CU Headers
    let myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", clickUpAPIKey);

    // CU JSON
    let raw = JSON.stringify({
      name: "Cover the firewood",
      description: `There is a ${precipitationProbability}% chance of precipitation for ${todaysDate}. Make sure you cover the firewood today.`,
      assignees: [44411049],
      tags: ["accuweather-app"],
      status: "To Do",
      priority: 2,
      due_date: dueDate,
      due_date_time: false,
      start_date_time: false,
      notify_all: true,
    });

    // CU Request
    let requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    // CU Promise
    const clickUpTaskData = await fetch(
      `${clickupURL}/list/${clickupListID}/task`,
      requestOptions
    ).catch((err) => console.log(err));
  }
}

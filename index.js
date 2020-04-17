const fs = require("fs");
const asciichart = require("asciichart");
const https = require("http");
const readline = require("readline");

function getValueFrom(string, m) {
  let re = new RegExp(`<${m}>([.\\n\\s\\S]*?)(?=<\/${m}>)`, "gi");
  return string.match(re)[0].replace(`<${m}>`, "").replace("kB", "");
}

function parse(file, appName) {
  console.log("Start parsing XML data");
  let data = {
    VmPeak: [],
    VmSize: [],
    RssAnon: [],
    RssFile: [],
    VmData: [],
    Threads: [],
  };

  let re = new RegExp(
    `(<Name>${appName}<\/Name>[.\\s\\S]*?(?=<\/status>))`,
    "gi"
  );
  const result = file.match(re);
  if (!result) {
    console.error(`Error - could not find application name: ${appName}`);
    process.exit(1);
    return;
  }
  result.forEach((parsedText) => {
    Object.keys(data).forEach((key) => {
      data[key].push(Number(getValueFrom(parsedText, key)));
    });
  });

  Object.keys(data).forEach((key) => {
    plotDataFor(key, data[key]);
  });
}

function getDataFromRoku(data, endpoint) {
  https
    .get(endpoint, (resp) => {
      resp.on("data", (chunk) => {
        data.value += chunk;
      });
    })
    .on("error", (err) => {
      console.log("Error: " + err.message);
    });
}

async function main() {
  const ip_address = process.argv[2];
  const appName = process.argv[3];
  if (!appName) {
    console.error("Expected an App Name for the second argument");
    return;
  }
  if (!ip_address || !ip_address.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)) {
    console.error("Expected the IP address of your Roku box");
    return;
  }

  const endpoint = `http://${ip_address}:8060/query/procinfo-ex/secret`;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (process.argv[4] && isNaN(process.argv[4])) {
    console.error(
      "Expected second argument to be a number but received: ",
      process.argv[4]
    );
    process.exit(0);
    return;
  }
  let data = { value: "" };
  getDataFromRoku(data, endpoint);
  let interval = setInterval(() => {
    getDataFromRoku(data, endpoint);
  }, Number(process.argv[4]) || 10000);

  rl.question("Type anything to stop collecting data \n", (answer) => {
    parse(data.value, appName);
    console.log("Done");
    clearInterval(interval);
    rl.close();
    process.exit(0);
  });
  return;
}

function plotDataFor(key, data) {
  console.log(key);
  let padding = "       ";
  let label = key == "Threads" ? "" : "kB";
  let size = key == "Threads" ? 0 : 2;
  console.log(
    asciichart.plot(data, {
      offset: 3,
      padding,
      height: 10,
      format: function (x, i) {
        return x.toFixed(size) + label;
      },
    })
  );
  console.log("---------\n");
}

main();

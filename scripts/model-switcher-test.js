const axios = require("axios");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const url = "http://localhost:3000/api/analyze";

  for (let i = 1; i <= 20; i++) {
    try {
      const res = await axios.post(url, {
        structured_data: { i, ts: new Date().toISOString() },
        notes: ["quota test"],
      });
      console.log(i, "OK", res.status);
    } catch (e) {
      console.log(i, "ERR", e.response?.status, e.response?.data || e.message);
    }

    await sleep(600);
  }
}

run();

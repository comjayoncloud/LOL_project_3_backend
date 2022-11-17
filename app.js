// api token을 이용하여 Riot Api서버에서 데이터를 받아온후 커스텀 마이징 후 노드서버에서 요청시 json 반환
// 순서 :
// 0. app.get()
// 1. getSummoner()
// 2. getMatchId()
// 3. getMatch()

const express = require("express");
const app = express();
const port = 8080;
const request = require("request");
const axios = require("axios");
const { get } = require("request");
const cors = require("cors");

app.use(cors());
app.use(express.json());

//api token
const api_token = "RGAPI-920c5c0b-dd99-4018-86b9-305d7508d335";

// 한국서버 요청
// 0. get 요청왔을때 respond 하는 함수

app.get("/api/allinfo/kr", async (req, res) => {
  console.log("connected");
  const id = req.query.id;
  const region = req.query.region;

  const summoner = await getSummoner(id, region);
  const matchIdList = await getMatchId(
    `${summoner.puuid}/ids?start=0&count=20`,
    region //puuid /ids?start=0&count=20`
  );

  const matchList = [];

  for (const matchId of matchIdList) {
    try {
      matchList.push(await getMatch(matchId, summoner));
    } catch (e) {
      console.log("에러났어요");
    }
  }
  res.header("Access-Control-Allow-Origin", "*");
  res.json(matchList);
});

// 1. puuid 요청하는 함수
getSummoner = async (name, regionName) => {
  console.log(regionName);
  if (regionName == "Korea") {
    const url = `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}`;
    const encoded = encodeURI(url);
    const summoner = await axios.get(encoded, {
      headers: {
        "X-Riot-Token": api_token,
      },
    });
    return summoner.data;
  } else if (regionName == "America") {
    const url = `https://la1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}`;
    const summoner = await axios.get(url, {
      headers: {
        "X-Riot-Token": api_token,
      },
    });
    return summoner.data;
  }
};

// 2. 최근전적 20개 matchid 요청하는 함수   ex) ["1232141","123141421" ... ]
getMatchId = async (puuid, regionName) => {
  if (regionName == "Korea") {
    const matchId = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}`,
      {
        headers: {
          "X-Riot-Token": api_token,
        },
      }
    );

    return matchId.data;
  } else if (regionName == "America") {
    const matchId = await axios.get(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}`,
      {
        headers: {
          "X-Riot-Token": api_token,
        },
      }
    );

    return matchId.data;
  }
};

// 3. riot api 에서 한 아이디에 대해 데이터를 요청 후 데이터를 커스텀마이징
getMatch = async (matchId, summoner) => {
  const matchInfo = await axios.get(
    `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
    {
      headers: {
        "X-Riot-Token": api_token,
      },
    }
  );
  const participants = matchInfo.data.info.participants;
  let championName = null;
  let win = null;
  let stat = null;
  let kda = null;

  let summonerLevel = null;
  let timePlayed = null;
  let killParticipation = null;
  let summonerCs = null;

  let summonerItem = [];
  let summonerRunes = [];

  let myteamlist = [];
  let notmyteamlist = [];

  // 입력받은 유저의 정보
  participants.forEach((x, index) => {
    if (x.puuid == summoner.puuid) {
      championName = x.championName;
      win = x.win ? "승" : "패";
      stat = x.kills + "/" + x.deaths + "/" + x.assists;
      summonerLevel = x.summonerLevel;
      timePlayed = x.timePlayed;
      killParticipation = Math.round(x.challenges.killParticipation * 100);
      summonerCs = x.totalMinionsKilled;
      kda = x.challenges.kda.toFixed(2);

      summonerItem.push(x.item0);
      summonerItem.push(x.item1);
      summonerItem.push(x.item2);
      summonerItem.push(x.item3);
      summonerItem.push(x.item4);
      summonerItem.push(x.item5);
      summonerItem.push(x.item6);
      summonerRunes.push(x.perks.styles[0].selections[0].perk);
      summonerRunes.push(x.perks.styles[1].style);
    }
  });

  // 우리팀 적팀 구분
  participants.forEach((x, index) => {
    if (x.teamId == "100") {
      myteamlist.push({ champ: x.championName, name: x.summonerName });
    } else if (x.teamId == "200") {
      notmyteamlist.push({ champ: x.championName, name: x.summonerName });
    }
  });

  // 게임모드 영->한
  if (matchInfo.data.info.gameMode == "ARAM") {
    matchInfo.data.info.gameMode = "칼바람나락";
  } else if (matchInfo.data.info.gameMode == "CLASSIC") {
    matchInfo.data.infogameMode = "소환사의 협곡";
  }

  let allInfo = {
    gameType: matchInfo.data.info.gameMode,
    gameResult: win,
    champName: championName,
    summonerLevel: summonerLevel,
    timePlayed: timePlayed,
    summonerItem: summonerItem,
    summonerKda: kda,
    summonerCS: summonerCs,
    summonerRunes: summonerRunes,

    gameStat: stat,
    killParticipation: killParticipation,

    myTeam: myteamlist,
    notmyTeam: notmyteamlist,
  };
  return allInfo;
};

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
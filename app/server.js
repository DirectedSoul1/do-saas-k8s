const express = require("express");
const app = express();
app.get("/healthz",(req,res)=>res.send("ok"));
app.get("/",(req,res)=>res.json({service:"do-saas-k8s", ts:Date.now()}));
app.listen(process.env.PORT||3000, ()=>console.log("listening"));

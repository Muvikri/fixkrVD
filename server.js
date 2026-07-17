import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from "fs";
import crypto from 'crypto';
import 'dotenv/config';

const app = express();
/* 
ini untuk localhost kalau misal besok udah prod jangan lupa diubah
jadi pakai http atau https ya.
*/
const CFG = { serverUrl: process.env.SERVER_URL, port: process.env.PORT };

// pake json
app.use(express.json());
// buat endpoint folder
app.use("/downloads", express.static(path.join(process.cwd(), 'downloads')));

app.use(express.static("public"))

app.post("/download", (req, res) => {
    const url = req.body.url
    // atur filename sama outputnya
    const filename = `${crypto.randomUUID()}.mp4`
    const output = path.join("downloads/", filename);

    /*const process = spawn("yt-dlp", [
        "-f", "bv*+ba/b",
        "--merge-output-format", "mp4",
        "-o", output,
        url
    ]);*/

    const process = spawn("yt-dlp", [
        "-o", output,
        url
    ]);
    // logger
    process.stderr.on("data", (data) => {
        console.log(data.toString());
    });
    process.stdout.on("data", (data) => {
        console.log(data.toString());
    });
    process.on("close", (code) => {
        console.log(`exiting!, code = ${code}`)

        if (code !== 0) {

            return res.status(500).json({
                success: false,
                messages: "gagal",
                error: "gagal, cek konsol"
            })
        }
        return res.json({
            success: true,
            messages: "berhasil",
            url: `${CFG.serverUrl}:${CFG.port}/downloads/${filename}`
        });
    });


});
app.listen(CFG.port, () => {
    console.log("server running");
});
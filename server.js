import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from "fs";
import crypto from 'crypto';
import 'dotenv/config';
import { request } from 'http';

const app = express();
/* 
CONFIG

ini untuk localhost kalau misal besok udah prod jangan lupa diubah
jadi pakai http atau https ya.
*/
const CFG = { serverUrl: process.env.SERVER_URL, port: process.env.PORT };

// ======================
// anti spamm (blum dipake)
// ======================

// const activeDownloads = new Map();
// const cooldowns = new Map();

// const MAX_ACTIVE_DOWNLOADS = 3;
// const COOLDOWN_TIME = 60 * 1000;

// // helper
// function getClientIp(req) {
//     return req.ip;
// }

// function canDownload(ip) {
//     const active = activeDownloads.get(ip) || 0;

//     if (active >= MAX_ACTIVE_DOWNLOADS) {
//         return {
//             allowed: false,
//             reason: "too_many_active_downloads"
//         };
//     }

//     const cooldownUntil = cooldowns.get(ip);

//     if (cooldownUntil && cooldownUntil > Date.now()) {
//         return {
//             allowed: false,
//             reason: "cooldown",
//             remaining: cooldownUntil - Date.now()
//         };
//     }

//     return {
//         allowed: true
//     };
// }
// ======================

async function turnstileVerify(token) {
    console.log("verifikasi turnstile berjalan")
    if (!token) {
        console.log("token kosong!")
        return {
            success: false
        }
    };

    const verifyResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: token
            })
        }
    );

    const result = await verifyResponse.json();
    return result
}

// pake json
app.use(express.json());
app.set("trust proxy", true);

// buat endpoint folder
app.use("/downloads", express.static(path.join(process.cwd(), 'downloads')));

app.use(express.static("public"))

app.post("/getsimplemetadata", (req, res) => {
    const url = req.body.url

    const process = spawn("yt-dlp", [
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        url
    ])
    let stdout = "";
    process.stderr.on("data", (data) => {
        console.log(data.toString());
    });

    process.stdout.on("data", (data) => {
        console.log(data.toString());
        stdout += data.toString();
    });
    process.on("close", (code) => {
        console.log(`exiting!, code = ${code}`)
        const metadata = JSON.parse(stdout);

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
            title: metadata.title,
            thumbnail: metadata.thumbnail
        });
    });
})

app.post("/download", async (req, res) => {
    const url = req.body.url;
    const turnstileToken = req.body.turnstileToken;

    const turnstileCheck = await turnstileVerify(turnstileToken);
    if (!turnstileCheck.success) {
        return res.status(403).json({
            error: "Turnstile verification failed"
        });
    }
    const fileFormat = req.body.fileFormat.toLowerCase();
    const supportedFormats = ["mp4", "mov", "mkv"];
    // pastiin formatnya bener dulu, kalau ga langsung tolak request
    const isFormatCorrect = supportedFormats.includes(fileFormat);
    if (!isFormatCorrect) {
        return res.json({
            success: false,
            messages: "format tidak didukung!",
            error: "gagal"
        })
    };
    // atur filename sama outputnya
    const quality = req.body.quality || "bv*+ba/b";
    const videoQuality =
        `bestvideo[height<=${quality}]+bestaudio/` +
        `best[height<=${quality}]`;
    const filename = `${crypto.randomUUID()}.mp4`
    const output = path.join("downloads/", filename);
    const process = spawn("yt-dlp", [
        "-f", quality,
        "--merge-output-format", fileFormat,
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
            url: `${CFG.serverUrl}/downloads/${filename}`
        });
    });


});

app.post("/downloadaudio", async (req, res) => {
    const url = req.body.url;
    const turnstileToken = req.body.turnstileToken;

    const turnstileCheck = await turnstileVerify(turnstileToken);
    if (!turnstileCheck.success) {
        return res.status(403).json({
            error: "Turnstile verification failed"
        });
    }
    const fileFormat = req.body.fileFormat;
    const supportedFormats = ["mp4", "mov", "mkv"];
    // pastiin formatnya bener dulu, kalau ga langsung tolak request
    const isFormatCorrect = fileFormat.includes(supportedFormats);
    if (!isFormatCorrect) return res.json({
        success: false,
        messages: "format tidak didukung!",
        error: "gagal"
    })
    // atur filename sama outputnya
    const filename = `${crypto.randomUUID()}.mp3`
    const output = path.join("downloads/", filename);

    const process = spawn("yt-dlp", [
        "-f", "bv*+ba/b",
        "--audio-format", fileFormat,
        "-o", output,
        url
    ]);

    /* const process = spawn("yt-dlp", [
        "-o", output,
        url
    ]); */

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
/* 
// custom res, format untuk download lebih custom
app.post("/customdownload", (req, res) => {
    const url = req.body.url
    const fileFormat = req.body.format || "mp4";
    const quality = req.body.resolution || 1080;  // ni max res yang bisa dipake, jadi nggak mesti dapet segitu

    const format =
        `bestvideo[height<=${quality}]+bestaudio/` +
        `best[height<=${quality}]`;
    // atur filename sama outputnya
    const filename = `${crypto.randomUUID()}${fileFormat}`
    const output = path.join("downloads/", filename);

    const process = spawn("yt-dlp", [
        "-f", format,
        "--merge-output-format", fileFormat,
        "-o", output,
        url
    ]);

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


}); */

app.listen(CFG.port, () => {
    console.log(`Server running in localhost:${CFG.port}`);
});
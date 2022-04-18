const core = require('@actions/core');
const github = require('@actions/github');
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const unified_agent_url = 'https://unified-agent.s3.amazonaws.com/wss-unified-agent.jar'
const unified_agent_name = 'wss-unified-agent.jar'
const main = async () => {
    try {

        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const pr_number = core.getInput('pr_number', { required: true });
        const token = core.getInput('token', { required: true });


        const octokit = new github.getOctokit(token);


        const { data: changedFiles } = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: pr_number,
        });



        let diffData = {
            additions: 0,
            deletions: 0,
            changes: 0
        };

        diffData = changedFiles.reduce((acc, file) => {
            acc.additions += file.additions;
            acc.deletions += file.deletions;
            acc.changes += file.changes;
            return acc;
        }, diffData);


        for (const file of changedFiles) {

            const fileExtension = file.filename.split('.').pop();
            switch(fileExtension) {
                case 'md':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['markdown'],
                    });
                case 'js':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['javascript'],
                    });
                case 'yml':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['yaml'],
                    });
                case 'yaml':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['yaml'],
                    });
            }
        }

        console.log("Starting Download");
        await download();
        console.log("Finished Download");
        await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pr_number,
            body: `
        The Pull Request #${pr_number} has been updated with: \n
        - ${diffData.changes} changes \n
        - ${diffData.additions} additions \n
        - ${diffData.deletions} deletions \n
      `
        });

    } catch (error) {
        core.setFailed(error.message);
    }
}

function getFilenameFromUrl(url) {
    const u = new URL(url);
    const pathname = u.pathname;
    const pathClips = pathname.split("/");
    const filenameWithArgs = pathClips[pathClips.length - 1];
    return filenameWithArgs.replace(/\?.*/, "");
}

async function download() {
    {
        try {
            const text = unified_agent_url;
            const target = "/";
            const filename = unified_agent_name;
            let autoMatch = false;


            const url = (() => {
                if (!autoMatch) return text;
                if (autoMatch) {
                    const match = text.match(/\((.*)\)/);
                    if (match === null) return "";
                    return match[1] || "";
                }
            })();
            if (url.trim() === "") {
                core.setFailed("Failed to find a URL.");
                return;
            }
            console.log(`URL found: ${url}`);
            try {
                fs.mkdirSync(target, {
                    recursive: true,
                });
            } catch (e) {
                core.setFailed(`Failed to create target directory ${target}: ${e}`);
                return;
            }
            const body = await fetch(url)
                .then((x) => x.buffer())
                .catch((err) => {
                    core.setFailed(`Fail to download file ${url}: ${err}`);
                    return undefined;
                });
            if (body === undefined) return;
            console.log("Download completed.");
            let finalFilename = "";
            if (filename) {
                finalFilename = String(filename);
            } else {
                finalFilename = getFilenameFromUrl(url);
            }
            if (finalFilename === "") {
                core.setFailed("Filename not found. Please indicate it in the URL or set `filename` in the workflow.");
                return;
            }
            fs.writeFileSync(path.join(target, finalFilename), body);
            console.log("File saved.");
            core.setOutput("filename", finalFilename);
        } catch (error) {
            core.setFailed(error.message);
        }
    }
}

main();
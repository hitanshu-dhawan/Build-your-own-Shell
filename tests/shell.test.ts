import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SHELL_PATH = path.resolve("./your_program.sh");
const TEST_DIR = path.join(os.tmpdir(), "shell-tests-" + Math.random().toString(36).substring(7));

beforeAll(() => {
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
    }
});

afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

function runShell(input: string, env: NodeJS.ProcessEnv = process.env, cwd = TEST_DIR) {
    return spawnSync(SHELL_PATH, [], {
        input: input,
        encoding: "utf-8",
        env: { ...process.env, ...env },
        cwd: cwd, // Run in temp dir to avoid messing up workspace
    });
}

describe("Shell Integration Tests", () => {

    describe("Core Shell Behavior", () => {

        test("prints a prompt on startup", () => {
            const result = runShell("exit\n");
            expect(result.stdout).toStartWith("$ ");
        });

        test("handles invalid commands", () => {
            const result = runShell("invalid_mango_command\nexit\n");
            expect(result.stdout).toContain("invalid_mango_command: command not found");
        });

        test("runs multiple commands in a REPL", () => {
            const input = "invalid_command_1\ninvalid_command_2\ninvalid_command_3\nexit\n";
            const result = runShell(input);
            expect(result.stdout).toContain("invalid_command_1: command not found");
            expect(result.stdout).toContain("invalid_command_2: command not found");
            expect(result.stdout).toContain("invalid_command_3: command not found");
        });

        test("exits successfully with the 'exit' command", () => {
            const result = runShell("exit\n");
            expect(result.status).toBe(0);
        });

    });

    describe("Built-in Commands", () => {

        test("echo prints its arguments", () => {
            const result = runShell("echo grape banana\nexit\n");
            expect(result.stdout).toContain("grape banana");
        });

        test("pwd shows the current working directory", () => {
            const result = runShell("pwd\nexit\n");
            expect(result.stdout).toContain(TEST_DIR);
        });

        describe("type command", () => {

            const exeDir = path.join(TEST_DIR, "bin");
            const exePath = path.join(exeDir, "my_exe");

            beforeAll(() => {
                fs.mkdirSync(exeDir, { recursive: true });
                fs.writeFileSync(exePath, "#!/bin/sh\necho 'my_exe executed'");
                fs.chmodSync(exePath, "755");
            });

            const envWithExe = {
                ...process.env,
                PATH: `${exeDir}:${process.env.PATH}`,
            };

            test("identifies a builtin command", () => {
                const result = runShell("type echo\nexit\n");
                expect(result.stdout).toContain("echo is a shell builtin");
            });

            test("identifies 'exit' as a builtin", () => {
                const result = runShell("type exit\nexit\n");
                expect(result.stdout).toContain("exit is a shell builtin");
            });

            test("identifies 'type' as a builtin", () => {
                const result = runShell("type type\nexit\n");
                expect(result.stdout).toContain("type is a shell builtin");
            });

            test("reports when a command is not found", () => {
                const result = runShell("type invalid_apple_command\nexit\n");
                expect(result.stdout).toContain("invalid_apple_command: not found");
            });

            test("finds an executable in the PATH", () => {
                const result = runShell(`type my_exe\nexit\n`, envWithExe);
                expect(result.stdout).toContain(`my_exe is ${exePath}`);
            });

            test("finds executables across multiple PATH entries", () => {
                const dogDir = path.join(TEST_DIR, "dog");
                const antDir = path.join(TEST_DIR, "ant");
                const pigDir = path.join(TEST_DIR, "pig");
                fs.mkdirSync(dogDir, { recursive: true });
                fs.mkdirSync(antDir, { recursive: true });
                fs.mkdirSync(pigDir, { recursive: true });

                fs.writeFileSync(path.join(antDir, "my_exe"), "#!/bin/sh\necho 'ant exe'");
                fs.chmodSync(path.join(antDir, "my_exe"), "755");

                const customEnv = { ...process.env, PATH: `${dogDir}:${antDir}:${pigDir}:${process.env.PATH}` }
                const result = runShell(`type my_exe\nexit\n`, customEnv);
                expect(result.stdout).toContain(`my_exe is ${path.join(antDir, "my_exe")}`);
            });

        });

    });

    describe("Command Execution", () => {

        test("runs an external command", () => {
            const result = runShell("ls\nexit\n");
            expect(result.stdout).not.toContain("ls: command not found");
        });

        test("runs an executable from the PATH with arguments", () => {
            const exeDir = path.join(TEST_DIR, "run_exe_test");
            const exePath = path.join(exeDir, "custom_exe");

            fs.mkdirSync(exeDir, { recursive: true });
            fs.writeFileSync(
                exePath,
                `#!/bin/sh
                echo "Program was passed $# args (including program name)."
                echo "Arg #0 (program name): $0"
                echo "Arg #1: $1"
                echo "Arg #2: $2"`
            );
            fs.chmodSync(exePath, "755");

            const customEnv = { ...process.env, PATH: `${exeDir}:${process.env.PATH}` };
            const result = runShell("custom_exe David Emily\nexit\n", customEnv);

            expect(result.stdout).toContain("Program was passed 2 args (including program name).");
            expect(result.stdout).toContain(`Arg #0 (program name): ${exePath}`);
            expect(result.stdout).toContain("Arg #1: David");
            expect(result.stdout).toContain("Arg #2: Emily");
        });

        test("executes a command with a quoted name", () => {
            const exeDir = path.join(TEST_DIR, "quoted_exe");
            fs.mkdirSync(exeDir, { recursive: true });
            const exePath = path.join(exeDir, "exe  with  space");
            const outFile = path.join(exeDir, "f1");

            fs.writeFileSync(exePath, "#!/bin/sh\ncat $1");
            fs.chmodSync(exePath, "755");
            fs.writeFileSync(outFile, "blueberry orange.");

            const customEnv = { ...process.env, PATH: `${exeDir}:${process.env.PATH}` };
            const result = runShell(`'exe  with  space' ${outFile}\nexit\n`, customEnv);

            expect(result.stdout).toContain("blueberry orange.");
        });

    });

    describe("Directory Navigation", () => {

        test("cd changes directory with an absolute path", () => {
            const subDir = path.join(TEST_DIR, "apple", "pear", "raspberry");
            fs.mkdirSync(subDir, { recursive: true });
            const result = runShell(`cd ${subDir}\npwd\nexit\n`);
            expect(result.stdout).toContain(subDir);
        });

        test("cd changes directory with a relative path", () => {
            const startDir = path.join(TEST_DIR, "start");
            const subDir = path.join(startDir, "strawberry", "raspberry");
            fs.mkdirSync(subDir, { recursive: true });
            const result = runShell(`cd strawberry/raspberry\npwd\nexit\n`, process.env, startDir);
            expect(result.stdout).toContain(subDir);
        });

        test("cd navigates to the parent directory using '..'", () => {
            const parentDir = path.join(TEST_DIR, "parent");
            const childDir = path.join(parentDir, "child");
            fs.mkdirSync(childDir, { recursive: true });
            const result = runShell(`cd ..\npwd\nexit\n`, process.env, childDir);
            expect(result.stdout).toContain(parentDir);
        });

        test("cd navigates to the home directory using '~'", () => {
            const homeDir = path.join(TEST_DIR, "home");
            fs.mkdirSync(homeDir, { recursive: true });
            const customEnv = { ...process.env, HOME: homeDir };
            const result = runShell(`cd ~\npwd\nexit\n`, customEnv);
            expect(result.stdout).toContain(homeDir);
        });

        test("cd reports an error for a non-existent directory", () => {
            const result = runShell("cd /non-existing-directory\nexit\n");
            expect(result.stdout).toContain("cd: /non-existing-directory: No such file or directory");
        });

    });

    describe("Quoting", () => {

        test("handles single quotes to preserve literal values", () => {
            const result = runShell(`echo 'test     example' 'script''world' hello''shell\nexit\n`);
            expect(result.stdout).toContain("test     example scriptworld helloshell");
        });

        test("handles double quotes to preserve literal values", () => {
            const result = runShell(`echo "hello  world"  "shell""test"\nexit\n`);
            expect(result.stdout).toContain("hello  world shelltest");
        });

        test("handles backslashes to escape characters outside quotes", () => {
            const result = runShell(`echo example\\ \\ \\ \\ \\ \\ shell\nexit\n`);
            expect(result.stdout).toContain("example      shell");
        });

        test("treats backslashes as literals within single quotes", () => {
            const result = runShell(`echo 'script\\\\nexample'\nexit\n`);
            expect(result.stdout).toContain("script\\\\nexample");
        });

        test("handles escaped characters within double quotes", () => {
            const result = runShell(`echo "script\"insidequotes"shell\\\"\nexit\n`);
            const outputLines = result.stdout.split('\n');
            const lastOutput = outputLines[outputLines.length - 2].replace('$ ', '').trim();
            expect(lastOutput).toBe('scriptinsidequotesshell"');
        });

    });

    describe("Redirection", () => {

        test("redirects stdout to a file with '>'", () => {
            const outFile = path.join(TEST_DIR, "out.txt");
            runShell(`echo 'Hello Alice' > ${outFile}\nexit\n`);
            const content = fs.readFileSync(outFile, "utf-8");
            expect(content.trim()).toBe("Hello Alice");
        });

        test("redirects stderr to a file with '2>'", () => {
            const errFile = path.join(TEST_DIR, "err.txt");
            runShell(`ls -1 non-existent-file 2> ${errFile}\nexit\n`);
            const content = fs.readFileSync(errFile, "utf-8");
            expect(content).toMatch(/ls: (non-existent-file|cannot access 'non-existent-file'): No such file or directory/);
        });

        test("appends stdout to a file with '>>'", () => {
            const outFile = path.join(TEST_DIR, "append.txt");
            fs.writeFileSync(outFile, "line1\n");
            runShell(`echo line2 >> ${outFile}\nexit\n`);
            const content = fs.readFileSync(outFile, "utf-8");
            expect(content.trim()).toBe("line1\nline2");
        });

        test("appends stderr to a file with '2>>'", () => {
            const errFile = path.join(TEST_DIR, "append_err.txt");
            runShell(`ls -1 nofile 2>> ${errFile}\ncat nonexistent 2>> ${errFile}\nexit\n`);
            const content = fs.readFileSync(errFile, "utf-8");
            expect(content).toMatch(/ls: (nofile|cannot access 'nofile'): No such file or directory/);
            expect(content).toMatch(/cat: nonexistent: No such file or directory/);
        });

    });

    describe("History", () => {

        test("lists previously executed commands", () => {
            const input = "type history\necho one\necho two\nhistory\nexit\n";
            const result = runShell(input);
            const output = result.stdout;
            expect(output).toContain("history is a shell builtin");
            expect(output).toMatch(/2\s+echo one/);
            expect(output).toMatch(/3\s+echo two/);
            expect(output).toMatch(/4\s+history/);
        });

        test("limits the number of history entries shown", () => {
            const input = "echo one\necho two\necho three\nhistory 2\nexit\n";
            const result = runShell(input);
            const output = result.stdout;
            expect(output).not.toContain("echo one");
            expect(output).toMatch(/3\s+echo three/);
            expect(output).toMatch(/4\s+history 2/);
        });

        test("reads history from a file with 'history -r'", () => {
            const histFile = path.join(TEST_DIR, "test_history.txt");
            fs.writeFileSync(histFile, "echo line1\necho line2\n");
            const input = `history -r ${histFile}\nhistory\nexit\n`;
            const result = runShell(input);
            expect(result.stdout).toContain("echo line1");
            expect(result.stdout).toContain("echo line2");
        });

        test("writes history to a file with 'history -w'", () => {
            const histFile = path.join(TEST_DIR, "write_history.txt");
            const input = `echo one\necho two\nhistory -w ${histFile}\nexit\n`;
            runShell(input);
            const content = fs.readFileSync(histFile, "utf-8");
            expect(content).toContain("echo one\n");
            expect(content).toContain("echo two\n");
            expect(content).toContain(`history -w ${histFile}\n`);
        });

        test("appends history to a file with 'history -a'", () => {
            const histFile = path.join(TEST_DIR, "append_history.txt");
            fs.writeFileSync(histFile, "initial command\n");
            const input = `echo appended\nhistory -a ${histFile}\nexit\n`;
            runShell(input);
            const content = fs.readFileSync(histFile, "utf-8");
            expect(content).toContain("initial command\n");
            expect(content).toContain("echo appended\n");
        });

        test("reads history from HISTFILE on startup", () => {
            const histFile = path.join(TEST_DIR, "startup_history.txt");
            fs.writeFileSync(histFile, "startup command\n");
            const env = { ...process.env, HISTFILE: histFile };
            const result = runShell("history\nexit\n", env);
            expect(result.stdout).toContain("startup command");
        });

        test("writes history to HISTFILE on exit", () => {
            const histFile = path.join(TEST_DIR, "exit_history.txt");
            const env = { ...process.env, HISTFILE: histFile };
            runShell("echo on-exit-test\nexit\n", env);
            const content = fs.readFileSync(histFile, "utf-8");
            expect(content).toContain("echo on-exit-test\n");
        });

        test("appends history to HISTFILE on exit", () => {
            const histFile = path.join(TEST_DIR, "append_on_exit.txt");
            fs.writeFileSync(histFile, "existing line\n");
            const env = { ...process.env, HISTFILE: histFile };
            runShell("new command\nexit\n", env);
            const content = fs.readFileSync(histFile, "utf-8");
            expect(content).toContain("existing line\n");
            expect(content).toContain("new command\n");
        });

    });

    // NOTE: Autocompletion and interactive history navigation (arrow keys)
    // are difficult to test in a non-interactive runner and have been omitted.

});

# Build Your Own Shell

This project is a simple shell implementation written in TypeScript. It provides a basic command-line interface with support for built-in commands, external command execution, command history, and tab completion.

## Features

*   **REPL (Read-Eval-Print Loop):** A classic shell interface.
*   **Command Execution:** Supports both built-in commands and external executables found in the system's `PATH`.
*   **Built-in Commands:**
    *   `echo [text]`: Prints text to the console.
    *   `pwd`: Prints the current working directory.
    *   `cd [directory]`: Changes the current directory. Supports `~` for the home directory.
    *   `history`: Displays the command history. Supports `-r` (read from file), `-w` (write to file), and `-a` (append to file) options.
    *   `exit`: Exits the shell.
    *   `type [command]`: Displays information about a command, indicating if it's a built-in or an external executable.
*   **Command History:**
    *   Loads history from the file specified by the `HISTFILE` environment variable.
    *   Saves new commands to the history file on exit.
*   **Tab Completion:**
    *   Autocompletes built-in commands and external executables.
    *   Pressing `Tab` once will complete the command if there's a single match.
    *   Pressing `Tab` twice will list all possible completions.
*   **I/O Redirection:**
    *   Redirect standard output: `>` (overwrite) and `>>` (append).
    *   Redirect standard error: `2>` (overwrite) and `2>>` (append).

## Getting Started

### Prerequisites

*   [Bun](https://bun.sh/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/hitanshu-dhawan/Build-your-own-Shell.git
    cd Build-your-own-Shell
    ```
2.  Install dependencies:
    ```bash
    bun install
    ```

### Running the Shell

To start the shell, run the following command:

```bash
./your_program.sh
```

### Running Tests

To run the test suite, use the following command:

```bash
bun run test
```

## How It Works

The shell is built around a main REPL in `app/main.ts`. It uses a `readline` interface to read user input. When a command is entered, it's parsed into a command and arguments. The shell then checks if the command is a built-in command. If it is, the corresponding command class from `app/commands.ts` is executed. If not, it searches for an executable in the system's `PATH` and executes it as a child process.

Utility functions in `app/utils.ts` handle tasks like parsing user input, finding executables, and managing I/O redirection.

# Cursed Time

A productivity and time-management web application heavily inspired by psychological horror and Junji Ito's manga aesthetic. "Cursed Time" combines a Pomodoro timer and a To-Do list, wrapped in an unsettling, monochrome, and atmospheric user interface.

**WARNING / STRICT ADVISORY**
This application contains psychological horror elements, sudden jumpscares, flashing lights, visual distortions, and loud screeching noises. It is not recommended for individuals with photosensitivity, heart conditions, anxiety, or those sensitive to startling content. Use at your own risk.

---

## User Guide & Terminology Translation

To maintain the horror immersion, the application uses thematic language. If you are a new user, here is a detailed, step-by-step breakdown of how to use the app and what each button actually means:

### Chapter 0 — The Threshold (Landing & Settings Page)
This is the very first screen you encounter when opening the application. It acts as the main menu where you configure your settings before entering the actual timer workspace.

*   **Surrender Your Soul To Enter (Login / Cloud Save):** In the context of the app's lore, surrendering your soul means creating a user account. **Please Note: This feature is currently under active development and is not yet functional.** In the future, this will allow you to save your tasks to a cloud database (Firebase) and access them across multiple devices.
*   **Enter Without Surrendering (Guest Mode / Local Storage):** **For now, you MUST click this option to use the application.** This button lets you bypass the login screen and use the app as a guest. All your tasks and timer data will be saved temporarily in your current browser's local storage.
*   **Jumpscare Imagery & Screech (Checkbox):** This is your safety toggle. If you want to use the timer peacefully without any horror interruptions, simply uncheck this box to disable all jumpscares and loud noises.
*   **Volume Slider:** If you choose to keep the jumpscares active, you can use this slider to adjust how loud the scream will be.
*   **Test the Omen Button:** A preview button that allows you to safely test the jumpscare visual and audio at your current volume setting before you start working.

### Chapter I — The Weight (To-Do List Section)
Once you enter the main application, the left panel functions as your standard task manager.
*   **Burdens of the Mind:** The list of your currently active tasks.
*   **Name the Burden ("What gnaws at you..."):** The text input field where you type the name of the task you want to complete.
*   **The Hour of Reckoning:** A date and time picker to set a deadline or schedule for your task.
*   **Invite New Torment:** The "Add Task" button. Clicking this will save your typed task into the list.

### Chapter II — The Hour (Pomodoro Timer Section)
The right panel is your focus timer, designed to keep you productive through timed sessions.
*   **The Turning Spiral:** The visual representation of your running timer.
*   **Let the Spiral Turn:** The "Start / Resume Timer" button.
*   **Unwind the Hour:** The "Pause / Reset Timer" button.
*   **Length of the Hour (Minutes):** Quick-select buttons to set your focus duration (15, 25, 45, 60, or 1 minute for quick testing).
*   **Hours Endured:** A counter showing how many timer sessions you have successfully completed.

---

## Current Development Status
As mentioned in Chapter 0, the application currently relies strictly on local browser storage ("Enter Without Surrendering"). The User Authentication and Database integration features are being actively built. 

## Built With
*   HTML5
*   CSS3 (Custom animations and monochrome styling)
*   Vanilla JavaScript (DOM manipulation and timer logic)

## Contributing
If you wish to contribute to the UI/UX, add new audio triggers, or help optimize the upcoming database integration, feel free to fork this repository and submit a pull request.

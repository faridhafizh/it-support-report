# 📱 IT Support — Native Kotlin Android App

A native Android application built in **Kotlin** for IT Support operators to seamlessly manage client complaints, update statuses, and sync data in real time with the **IT Support WebUI & Excel Backend**.

---

## 🌟 Key Features

- **🔐 Secure Authentication**: Supports session token authentication via HTTP Header (`Authorization: Bearer <token>`) & Cookies with automatic session persistence.
- **📊 Real-time Summary KPI Cards**: Dynamic cards showing Total Tickets, Open, In Progress, Closed, and High Priority counts.
- **📋 Live Ticket List & Filtering**:
  - Filter tickets by status (Open, In Progress, Menunggu Client, Closed).
  - Instant text search across client name, description, department, and assigned PIC.
- **➕ Instant Ticket Creation**: Log new tickets with category, priority, status, description, and PIC directly from your Android device.
- **⚡ Fast Inline Status Updates**: Update ticket status directly from the list item spinner; closing a ticket automatically records today's completion date.
- **✏️ Detailed Ticket Editor**: Update solution notes, assigned PIC, and supplementary remarks without leaving the screen.
- **🗑️ Admin Role Controls**: Privileged deletion controls available for IT Administrators.

---

## 🛠️ Tech Stack & Architecture

- **Language**: [Kotlin](https://kotlinlang.org/) (JVM 17 Target)
- **Architecture**: MVVM (Model-View-ViewModel) + Repository Pattern
- **Networking**: [Retrofit 2.10](https://square.github.io/retrofit/) + [OkHttp 4.12](https://square.github.io/okhttp/) (Logging & Auth Interceptor)
- **Async Processing**: [Kotlin Coroutines](https://kotlinlang.org/docs/coroutines-overview.html) & `LiveData` / `ViewModel`
- **UI & Layout**: Material Design 3 (`MaterialCardView`, `CoordinatorLayout`, `SwipeRefreshLayout`, `ViewBinding`)
- **Min SDK**: Android 14 (API Level 34)
- **Target SDK**: Android 14 (API Level 34)

---

## 📂 Project Directory Structure

```
android/
├── app/
│   ├── build.gradle.kts           # Module-level Gradle configuration & dependencies
│   └── src/main/
│       ├── AndroidManifest.xml   # Permissions (INTERNET) & activity declarations
│       ├── java/com/itsupport/app/
│       │   ├── data/
│       │   │   ├── api/          # ITSupportApiService Retrofit interface
│       │   │   ├── model/        # Kotlin data classes (Ticket, User, Summary, etc.)
│       │   │   ├── network/      # ApiClient & SessionManager (SharedPreferences)
│       │   │   └── repository/   # ITSupportRepository layer
│       │   └── ui/
│       │       ├── login/        # LoginActivity
│       │       ├── main/         # MainActivity & TicketAdapter
│       │       └── viewmodel/    # LoginViewModel & DashboardViewModel
│       └── res/
│           ├── layout/           # Activity and Dialog XML layouts
│           └── values/           # Colors, Strings, Themes
├── build.gradle.kts              # Root build script
├── settings.gradle.kts           # Gradle settings & plugin repository definitions
└── gradle.properties             # Build properties
```

---

## 🚀 Getting Started

### Prerequisites

1. **Android Studio**: Android Studio Jellyfish (2023.3.1) or newer.
2. **JDK**: JDK 17 or higher.
3. **Backend Server**: Next.js IT Support WebUI running (`npm run dev`).

### Connecting to Next.js Backend Server

- **Android Emulator**: Use default URL `http://10.0.2.2:3000` (10.0.2.2 maps to `localhost` of your host computer).
- **Physical Android Device (Same Wi-Fi Network)**: Use your local computer's LAN IP address, for example `http://192.168.1.50:3000`.
  - Start Next.js bound to network:
    ```bash
    npx next dev -H 0.0.0.0 -p 3000
    ```

### How to Build & Run

1. Open **Android Studio**.
2. Select **Open an existing project** and choose the `android` folder in this repository.
3. Wait for Gradle sync to complete.
4. Run the project on an Android Emulator or connected device (`Shift + F10`).
5. On the Login screen:
   - Enter your **Server URL** (e.g. `http://10.0.2.2:3000`).
   - Enter **Username**: `admin` and **Password**: `Admin#Support2026`.
6. Tap **Login** to access the dashboard.

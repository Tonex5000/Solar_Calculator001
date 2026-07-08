# Solar Calculator

A comprehensive solar system sizing calculator that helps you determine the right inverter, batteries, and solar panels for your energy needs.

## Features

### 🔌 Load Calculation
- Search and select from 24+ common appliances
- Support for both **Watts** and **Horsepower (HP)** inputs
  - Air Conditioners, Inverters AC, and Water Pumps use HP input (1 HP = 746W)
- Real-time total load calculation with visual meter
- Appliance categorization: Inductive, Resistive, and Nonlinear loads

### ⚡ Inverter Sizing
- Automatic inverter recommendation based on total load
- Supports systems from 1 kVA to 50 kVA
- System voltage determined automatically (12V to 360V)

### 🔋 Battery Configuration
- **Tubular (Lead Acid)** and **Lithium** battery support
- Automatic efficiency settings (80% Tubular, 95% Lithium)
- Battery connection calculation:
  - Series connections (based on switching voltage)
  - Parallel connections (based on capacity requirements)
- Total battery count calculation

### ☀️ Solar Panel Sizing
- Panel wattage options: 300W, 400W, 500W, 550W, 580W, 630W, 650W
- Custom wattage input available
- Automatic panel count calculation based on charging hours

### 📋 Additional Features
- 4-step guided configuration process
- PDF quotation generation with full system breakdown
- Responsive design for desktop and mobile
- Visual load meter with inverter tier recommendations

## Tech Stack

**Frontend:** React, Vite, jsPDF

**Backend:** Python, FastAPI

## Getting Started

### Frontend
```bash
cd solar-calculator
npm install
npm run dev
```

### Backend
```bash
cd solar-backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoint

```
POST /calculate
```

**Request Body:**
```json
{
  "load": 5000,
  "backup_hours": 6,
  "battery_type": "tubular",
  "battery_eff": 0.8,
  "switching_volt": 120,
  "charging_hours": 5,
  "panel_wattage": 400
}
```

**Response:**
```json
{
  "inverter_watts": 12500.0,
  "inverter_kva": 12.5,
  "battery_ah": 625,
  "solar_watts": 5000.0,
  "number_of_panels": 13,
  "battery_count": 20,
  "battery_type": "tubular",
  "series_connection": 10,
  "parallel_connection": 2
}
```

## System Flow

1. **Step 1 - Load:** Enter appliances and their wattage/horsepower
2. **Step 2 - Backup:** Select battery type and backup hours
3. **Step 3 - Charging:** Set available charging hours
4. **Step 4 - Panels:** Choose solar panel wattage
5. **Results:** View recommendations and download PDF quotation

## Battery Connection Formula

### Tubular Batteries
- **Series:** `switching_volt / 12V` (per battery)
- **Parallel:** `total_battery_ah / (switching_volt × 220)`
- **Total:** `series × parallel`

### Lithium Batteries
- **Series:** `switching_volt / 12V`
- **Parallel:** `total_battery_ah / 200Ah`
- **Total:** `series × parallel`

---

*Built for solar installers and homeowners planning their solar energy systems.*

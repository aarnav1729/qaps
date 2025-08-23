// auto-generated from Book 56.xlsx and Book 57.xlsx
// Do not edit by hand. Update the Excel masters and regenerate.

export type Technology = "M10" | "G12R" | "G12";

export interface BomComponentOption {
  model: string; // Part No / Type / Model
  subVendor?: string | null;
  spec?: string | null;
}

export type BomComponentName =
  | "Solar Cell"
  | "Front Cover"
  | "Back Cover"
  | "Cell Connector"
  | "String Connector"
  | "Frame"
  | "Junction Box"
  | "Sealant (Adhesives)"
  | "MC4 Compatible Connector"
  | "Potting Material"
  | "EVA (Encapsulation) Front"
  | "EVA (Encapsulation) Back"
  | "Bypass Diode"
  | "Solar Cable"
  | "Fluxing Agent"
  | "Additional Material (Fixing Tape and Insulation Tape)";

export const VENDOR_NAME_LOCKIN = "Premier Energies" as const;
export const RFID_LOCATION_LOCKIN = "TOP Left Side, front view" as const;
export const TECHNOLOGIES: Technology[] = ["M10", "G12R", "G12"];

export const BOM_MASTER: Record<BomComponentName, BomComponentOption[]> = {
  "Solar Cell": [
    {
      model: "N-210BM-16D1-F186R192",
      subVendor: "Jietai",
      spec: "Mono-crystalline Bifacial TOPCon Solar cell-18bb 182.3 x105±1mm, 130±13μm",
    },
    {
      model: "PEPPL_PIRANHA_P Type(Mono facial)",
      subVendor: "Premier Energies",
      spec: "Mono Crystalline Perc-10bb 182 x 91± 1mm, 170 ± 17.5",
    },
    {
      model: "PEPPL_Blue Whale_P TYPE_G12_BIFACIAL",
      subVendor: "Premier Energies",
      spec: "Mono Crystalline Bifacial Perc12bb 210 x 105± 1mm, 160 ± 30",
    },
    {
      model: "PEPPL_PIRANHA_P TYPE_M10_BI-FACIAL",
      subVendor: "Premier Energies",
      spec: "Mono Crystalline Bifacial Perc10bb 182 x 91± 1mm, 170 ± 17.5",
    },
    {
      model: "S18210BB023",
      subVendor: "Jiangsu Longhengnew energy Co., Ltd (Solar Space)",
      spec: "Mono Crystalline Bifacial Perc Cell-10bb 182 x 91± 1mm, 160 ± 16",
    },
    {
      model: "CZJT-182M-10D11",
      subVendor: "Jietai Technology (JTPV)",
      spec: "Mono Crystalline Bifacial Solar Cell -10bb 182 x 91± 1mm, 140 ± 14",
    },
    {
      model: "7M9E1018A-L1",
      subVendor: "Aiko Solar",
      spec: "Mono Crystalline Bifacial Solar Cell -10bb 182.2 x 91.1± 1mm, 165 ±17.5",
    },
    {
      model: "CZJT-182M-16D1 M10 Topcon cell",
      subVendor: "Jietai Technology (JTPV)",
      spec: "Mono Crystalline Bifacial Solar Cell -16bb 182 x 91± 1mm, 130 ± 13 μm",
    },
    {
      model: "M182GBTCONBP",
      subVendor: "Tongwei Solar Co., Ltd",
      spec: "Mono Crystalline Bifacial TOPcon Solar Cell -16bb 182.2 x 91.1± 1mm, 130±20μm",
    },
    {
      model: "N210AG18D1",
      subVendor: "Chuzhou Jietai New Energy Technology Co., Ltd",
      spec: "Mono-crystalline Bifacial TOPCon Solar Cell-18bb 210.0 x105±1mm, 130±13μm",
    },
    {
      model: "PE_BLUE SHARK_N TYPE_TOPCON",
      subVendor: "Premier Energies",
      spec: "Mono-crystalline Bifacial TOPCon Solar Cell-16bb 182.3x105±1mm, 130±13μm",
    },
    {
      model: "N-210BM-16D1-F186R192",
      subVendor: "Chuzhou Jietai New Energy Technology Co., Ltd",
      spec: "Mono-crystalline Bifacial TOPCon Solar Cell-16bb 182.3 x105±1mm, 130±13μm",
    },
    {
      model: "N-type TOPcon 183.75-16BB",
      subVendor: "Anhui Shijing Solar Power Technology Co., Ltd.",
      spec: "Mono Crystalline Bifacial TOPcon Solar Cell -16bb 182.2 x 91.1± 1mm,130±13μm",
    },
    {
      model: "M18216BTP10",
      subVendor:
        "Solarspace Technology (Laos) Sole Co., Ltd. Jiangsu Longheng New Energy Co., Ltd. Solarspace New Energy (Xuzhou) Co., Ltd. Solarspace NewEnergy (Chuzhou) Co., Ltd Jiangsu Huaheng New Energy Co., Ltd",
      spec: "Mono Crystalline Bifacial TOPCon Solar Cell -16bb 182.2 x 91.1± 1mm,130±13μm",
    },
    {
      model: "N-TOPCon-Bifacial_210R Mono_16BB",
      subVendor: "Trina Solar Energy Co., Ltd",
      spec: "Mono-crystalline Bifacial TOPCon solar cell-16bb 182.3x105±1mm, 130±13μm",
    },
    {
      model: "183R MBB NFH-TBNU",
      subVendor: "Jinko Solar",
      spec: "182.3mm*183.75mm±0.5mm 130±13μm,TOPCon Solar Cell",
    },
  ],

  "Front Cover": [
    {
      model: "HS Glass,2.0mm, Grid pattern",
      subVendor: "CSG/Flat/Xinyi/Kibing",
      spec: "Transmission data: ≥ 91.5%",
    },
    {
      model: "(A) AR coated Semi Tempered Solar Glass",
      subVendor: "Wujiang C.S.G. Glass Co., ltd. CSG Holding Co., Ltd Anhui CSG New Energy Material Technology Co., Ltd Dongguan CSG Solar Glass Co., Ltd Guangxi CSG New Energy Material Technology Co., Ltd",
      spec: "(A) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.5%",
    },
    {
      model: "(B) AR Coated Semi Tempered Solar Glass",
      subVendor: "Flat Glass group Zhejiang Jiafu Glass Co Flat (Vietnam) Co., Ltd Anhui Flat Solar Glass Co,.Ltd Flat (Hong Kong) Co.,Limited.",
      spec: "(B) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.5%",
    },
    {
      model: "(C) AR Coated Semi Tempered Solar Glass",
      subVendor: "Borosil Renewables Limited",
      spec: "(C) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.5%",
    },
    {
      model: "(D) AR Coated Semi Tempered HS Solar Glass",
      subVendor: "Xinyi Solar (Malaysla) SDN. BHD Xinyi Solar (SuZhou) Ltd. Guangxi Xinyi Photovaltaic Industry Co.,Ltd. Xinyi PV Products (Anhui) Holdings Ltd",
      spec: "(D) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.5%",
    },
    {
      model: "(E) AR Coated Semi Tempered HS Solar Glass",
      subVendor: "Hunan Kibing Solar Technology Co., Ltd Zhejiang Ninghai Kibing New Energy Management Co. Ltd",
      spec: "(E) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.5%",
    },
  ],

  "Back Cover": [
    {
      model: "HS Glass,ARC coated, 2.0mm",
      subVendor: "CSG/Flat/Xinyi/Kibing",
      spec: "Transmission Data: ≥ 93.5%",
    },
    {
      model: "(A) Heat Strengthened Glass- Grid Patterned",
      subVendor: "Wujiang C.S.G. Glass Co., ltd. CSG Holding Co., Ltd Anhui CSG New Energy Material Technology Co., Ltd Dongguan CSG Solar Glass Co., Ltd Guangxi CSG New Energy Material Technology Co., Ltd",
      spec: "(A) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.6%",
    },
    {
      model: "(B) Heat Strengthened Glass- Grid Patterned",
      subVendor: "Flat Glass group Zhejiang Jiafu Glass Co Flat (Vietnam) Co., Ltd Anhui Flat Solar Glass Co,.Ltd Flat (Hong Kong) Co.,Limited",
      spec: "(B) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.6%",
    },
    {
      model: "(C) Heat Strengthened Glass- Grid Patterned",
      subVendor: "Borosil Renewables Limited",
      spec: "(C) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission data: ≥ 91.6%",
    },
    {
      model: "(D) Semi tempered HS with Grid Patterned Glass",
      subVendor: "Xinyi Solar (Malaysla) SDN. BHD Xinyi Solar (SuZhou) Ltd. Guangxi Xinyi Photovaltaic Industry Co.,Ltd. Xinyi PV Products (Anhui) Holdings Ltd",
      spec: "(D) Thickness [mm]: 2mm Surface treatment: AR Coated Transmission Data: ≥ 91.6%",
    },
    {
      model: "(E) Semi tempered HS with Grid Patterned Glass",
      subVendor: "Hunan Kibing Solar Technology Co., Ltd Zhejiang Ninghai Kibing New Energy Management Co. Ltd",
      spec: "(E) Thickness [mm]: 2mm Surface Treatment: AR Coated Transmission data: ≥ 91.6%",
    },
  ],

  "Cell Connector": [
    {
      model: "dia 0.26+/-0.04mm",
      subVendor: "Juren/twinsel/geba",
      spec: "Composition of alloy:Sn60Pb40",
    },
    {
      model: "(2) dia 0.26+/-0.04mm",
      subVendor: "ZhejiangTwinsel Electronic Technology Co., Ltd.",
      spec: "Dimensions[mm]:Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "(3) dia 0.26+/-0.04mm",
      subVendor: "Xi’an Telison New Materials Co., Ltd",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.280.26mm, Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "((4) dia 0.26+/-0.04mm",
      subVendor: "TaiCang JuRen PV Material Co., Ltd.",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "(5) dia 0.26+/-0.04mm",
      subVendor: "Shanghai Sunby Solar Electronic Technology Co.",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm, Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "(6) dia 0.26+/-0.04mm",
      subVendor: "Valeo",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "(7) dia 0.26+/-0.04mm",
      subVendor: "Sveck",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40",
    },
    {
      model: "(8) dia 0.26+/-0.04mm",
      subVendor: "Geba Cables and wires India Pvt Ltd",
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of alloy: Sn60Pb40"
    },
    {
      model: ":dia 0.26+/-0.04mm",
      subVendor: "Giga Storage Corporation",    
      spec: "Dimensions [mm]: Ø-0.32/0.30/0.28/0.26mm Ø:0.24+/-0.04mm Composition of Alloy: Sn60Pb40",
    },
  ],

  "String Connector": [
    {
      model: "4(+2)x0.4mm",
      subVendor: "Juren/twinsel/geba",
      spec: "Composition of alloy:Sn60Pb40",
    },
    {
      model: "(A) Silver/Black",
      subVendor: "ZhejiangTwinsel Electronic Technology Co., Ltd.",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(B) Silver/Black",
      subVendor: "Xi’an Telison New Materials Co., Ltd",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(C) Silver/Black",
      subVendor: "TaiCang JuRen PV Material Co., Ltd.",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(D) Silver",
      subVendor: "Shanghai Sunby Solar Electronic Technology Co.",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(E) Silver/Black",
      subVendor: "Valeo",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(F) Silver/Black",
      subVendor: "Sveck",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "(G) Silver/Black",
      subVendor: "Geba Cables and wires India Pvt Ltd",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
    {
      model: "Silver/Black",
      subVendor: "Xi’an Telison New Materials Co., Ltd",
      spec: "Dimensions [mm]: 4(+2)x0.4mm Composition of alloy:Sn60Pb40",
    },
  ],

  "Frame": [
    {
      model: "6005T6,30x30/15mm",
      subVendor: "New SULV/Haihong/tinze/Anan/Fuzhou Antong",
      spec: "6005T6,30x30/15mm, Anodising coating thickness >15microns",
    },
    {
      model: "35X33/18mm",
      subVendor: "New SULV/Haihong/tinze/Anan/Fuzhou Antong",
      spec: "6005T6,35x33/18mm, Anodising coating thickness >15microns",
    },
    {
      model: "A",
      subVendor: "Jiangyin HaiHong New Energy Technology Co., ltd",
      spec: "",
    },
    {
      model: "B",
      subVendor: "Akcome",
      spec: "",
    },
    {
      model: "C",
      subVendor: "Jiangyin New Sulv Technology Co., ltd.",
      spec: "",
    },
    {
      model: "D",
      subVendor: "YuanshuoMetal Technology Co., ltd.",
      spec: "",
    },
    {
      model: "E",
      subVendor: "Jiangyin East China Corp. Ltd",
      spec: "",
    },
    {
      model: "F",
      subVendor: "Jiangyin Wangfa technology Co.,ltd",
      spec: "",
    },
    {
      model: "G",
      subVendor: "Tianmu",
      spec: "",
    },
    {
      model: "H",
      subVendor: "Chizhou Anan Aluminium Co. Ltd",
      spec: "",
    },
    {
      model: "I",
      subVendor: "Jiangyin Tinze new energy Technology Co. Ltd",
      spec: "",
    },
    {
      model: "J",
      subVendor: "Zhejiang jiaxin taihe new energy",
      spec: "",
    },
    {
      model: "K",
      subVendor: "Fuzhou Antong New Material Technology Co.,Ltd",
      spec: "",
    },
    {
      model: "L",
      subVendor: "Guangxi Anan New Energy Material Technology Co., Ltd",
      spec: "",
    },
  ],

  "Junction Box": [
    {
      model: "TL-BOX216x",
      subVendor: "Tongling",
      spec: "(1) Rated Voltage: 1500V DC, Rated Current: 30A, IP68",
    },
    {
      model: "TL-BOX216x",
      subVendor: "Jiangsu Tonglin Electric Co., Ltd",
      spec: "(2) Rated Voltage: 1500V DC, Rated Current: 30A, IP68",
    },
    {
      model: " PV-GZX307",
      subVendor: "Ningbo GZX PV Technology Co.,ltd",
      spec: "(3) Rated Voltage: 1500V DC, Rated Current: 30A, IP68, ",
    },
    {
      model: "DSJB12y (y=c)",
      subVendor: "Dhash PV Technologies pvt, Ltd",
      spec: "Max. voltage [V]: 1500 Max. current [A]: 30",
    },
    {
      model: "PV-ZH011C-5",
      subVendor: "Zhejiang Zhonghuan Sunter PV Technology Co., Ltd.,",
      spec: "Max. voltage [V]: 1500 Max. current [A]: 25*/30 ",
    },
    {
      model: "3Qxy (x = 3 or 4 and y = 1)",
      subVendor: "QC Solar (Suzhou) Corporation",
      spec: "Max. voltage [V]: 1500 Max. current [A]: 25*/30",
    },
    {
      model: "PVZH011C-5M",
      subVendor: "Zhejiang Zhonghuan Sunter PV Technology Co., Ltd.,",
      spec: "Max. voltage [V]: 1500 Max. current [A]: 30",
    },
  ],

  "MC4 Compatible Connector": [
    {
      model: "TL-CABLE01S",
      subVendor: "Tongling",
      spec: "Max. voltage [V]:1500 Max. current [A]: 39A",
    },
    {
      model: "TL-CABLE01S",
      subVendor: "Jiangsu Tonglin Electric Co., Ltd.",
      spec: "Max. voltage [V]:1500 Max. current [A]: 41 RTI [°C]: 100",
    },
    {
      model: "PV-GZX1500",
      subVendor: "Ningbo GZX PV Technology Co., Ltd.",
      spec: "Max. voltage [V]:1500 Max. current [A]: 39",
    },
    {
      model: "DS01",
      subVendor: "Dhash PV Technologies pvt, Ltd",
      spec: "Max. voltage = 1500VDC Max. Current =40A Max Temp = 100°C",
    },
    {
      model: "PV-KST4-EVO 2A/xy(M) PV-KBT4-EVO 2A/xy(M)",
      subVendor: "Staubli Elecirical Connectors AG",
      spec: "Max. voltage = 1500VDC Max. Current =45A Max Temp = 100°C",
    },
    {
      model: "PV-ZH202B",
      subVendor: "Zhejiang Zhonghuan Sunter PV Technology Co., Ltd.,",
      spec: "Max. voltage [V]:1500 Max. current [A]: 40", 
    },
    {
      model: "PVKST4/xy_EVO2/xy_ UR PV-KBT4-EVO 2/xy_UR",
      subVendor: "Staubli Electrical Connectors AG",
      spec: "Max. voltage [V]:1500 Max. current [A]: 40",
    },
    {
      model: "QC4.10-cds",
      subVendor: "QC Solar (Suzhou) Corporation",
      spec: "Max. voltage [V]:1500 Max. current [A]: 41",
    },
    {
      model: "UTXCFabcde UTXCMabcde",
      subVendor: "Amphenol Technology (Shenzhen) Co., Ltd.",
      spec: "Max. voltage [V]:1500 Max. current [A]: 40",
    },
  ],

  "Sealant (Adhesives)": [
    {
      model: "SMG533/MH3668/JS606/HT906Z",
      subVendor: "Baiyun/minghao/Zhejiang/huitian",
      spec: "One component Silicon Sealant",
    },
    {
      model: "MH-3668",
      subVendor: "Jiangsu Minghao new Material Sci-Tech Corporation",
      spec: "Neutral cured silicone sealant (White/Black)",
    },
    {
      model: "SMG-533",
      subVendor: "Guangzhou Baiyun Chemical Industry Co. Ltd",
      spec: "Neutral cured silicone sealant (White/Black)",
    },
    {
      model: "HT906Z",
      subVendor: "Shanghai Huitian New Material Co., Ltd.",
      spec: "One component Silicon sealant",
    },
    {
      model: "JS-606",
      subVendor: "Hangzhou Zhijiang Silicone Chemicals CO.,Ltd",
      spec: "Neutral cured silicone sealant (White/Black)",
    },
  ],

  "Potting Material": [
    {
      model: "SKF323AB/MH3667/JS1184/5299WS",
      subVendor: "Baiyun/minghao/Zhejiang/huitian",
      spec: "RTV silicone potting compound",
    },
    {
      model: "MH 3667",
      subVendor: "Jiangsu Minghao new Material Sci-Tech Corporation",
      spec: "RTV silicone potting compound",
    },
    {
      model: "SKF323-AB",
      subVendor: "Guangzhou Baiyun Chemical Industry Co. Ltd",
      spec: "RTV silicone potting compound",
    },
    {
      model: "JS-1184",
      subVendor: "Hangzhou Zhijiang Silicone Chemicals CO., Ltd",
      spec: "Silicone Pouring Sealant",
    },
    {
      model: "5299W-S,",
      subVendor: "Shanghai Huitian New Material Co., Ltd.",
      spec: "RTV silicone potting compound",
    },
  ],

  "EVA (Encapsulation) Front": [
    {
      model: "F406PS",
      subVendor: "Hangzhou First Applied Material Co., Ltd/First Material Science (Thailand) Co., Ltd/ Vietnam Advance Film Material Company Limited",
      spec: "Thickness[mm]: 0.50mm±0.05mm CTI: 600V Max. Storage temp. [°C]: ≤ 30", 
    },
    {
      model: "SV-15296P",
      subVendor: "Changzhou Sveck PV New Material Co., Ltd",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max. Storage temp. [°C]: ≤ 30", 
    },
    {
      model: "EP 304",
      subVendor: "Hangzhou First Applied Material Co., Ltd/First Material Science (Thailand) Co., Ltd/ Vietnam Advance Film Material Company Limited",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max. Storage temp. [°C]: ≤ 30 ",
    },
    {
      model: "CO-556",
      subVendor: "Changzhou Sveck PV New Material Co., Ltd",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max.Storage temp[°C]: ≤ 30",
    },
    {
      model: "HEP-01MT",
      subVendor: "Hanwha Advanced Materials Corporation",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max.Storage temp[°C]: ≤ 30",
    },
  ],

  "EVA (Encapsulation) Back": [
    {
      model: "EP308",
      subVendor: "Hangzhou First Applied Material Co., Ltd/First Material Science (Thailand) Co., Ltd/ Vietnam Advance Film Material Company Limited",
      spec: "Thickness[mm]: 0.50mm±0.05mm CTI: 600V Max. Storage temp. [°C]: ≤ 30",
    },
    {
      model: "CO-557",
      subVendor: "Changzhou Sveck PV New Material Co., Ltd",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max. Storage temp. [°C]: ≤ 30",
    },
    {
      model: "EP308",
      subVendor: "Hangzhou First Applied Material Co., Ltd/First Material Science (Thailand) Co., Ltd/ Vietnam Advance Film Material Company Limited",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max. Storage temp. [°C]: ≤ 30",
    },
    {
      model: "CO-557",
      subVendor: "Changzhou Sveck PV New Material Co., Ltd",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max.Storage temp[°C]: ≤ 30",
    },
    {
      model: "HEP-01M",
      subVendor: "Hanwha Advanced Materials Corporation",
      spec: "Thickness[mm]: 0.50±0.05 CTI: 600V Max.Storage temp[°C]: ≤ 30",
    }
  ],

  "Bypass Diode": [
    {
      model: "PT001H-30",
      subVendor: "Tongling",
      spec: "Tj max= 200 °C",
    },
    {
      model: "PT001H-30",
      subVendor: "Jiangsu Tonglin Electric Co., Ltd",
      spec: "Tj max= 200 °C",
    },
    {
      model: "40SQ045",
      subVendor: "PanJit International Inc.",
      spec: "Tj max= 200 °C",
    },
    {
      model: "GF5545",
      subVendor: "Ningbo GZX PV Technology Co., Ltd",
      spec: "Tj max= 200 °C",
    },
    {
      model: "GF3545",
      subVendor: "Ningbo GZX PV Technology Co., Ltd",
      spec: "Tj max= 200 °C",
    },
    {
      model: "GF5045",
      subVendor: "Ningbo GZX PV Technology Co., Ltd",
      spec: "Tj max= 200 °C",
    },
    {
      model: "GF5045E",
      subVendor: "Ningbo GZX PV Technology Co., Ltd",
      spec: "Tj max= 200 °C",
    },
    {
      model: "DS5045T",
      subVendor: "SMC diode solutions",
      spec: "Max. diode current [A]: 50 Tj [°C]: 200",
    },
    {
      model: "DS4045T",
      subVendor: "SMC diode solutions",
      spec: "Max. diode current [A]: 50 Tj [°C]: 200",
    },
    {
      model: "GF5045",
      subVendor: "Hornby Electronic",
      spec: "Max. diode current [A]: 50 Tj [°C]: 200",
    },
    {
      model: "MK5045",
      subVendor: "Taizhou Chuangda Electronic Co. Ltd",
      spec: "Max. diode current [A]: 50 Tj [°C]: 200",
    },
    {
      model: "35SQ045 for 25A",
      subVendor: "Panjit Electronics",
      spec: "Max. diode current [A]: 35/40 Tj [°C]: 200",
    },
    {
      model: "40SQ045 for 30A",
      subVendor: "Panjit Electronics",
      spec: "Max. diode current [A]: 35/40 Tj [°C]: 200",
    },
    {
      model: "QCM4045 QCM5045 40SQ045 30SQ050A QCM5045B",
      subVendor: "QC Solar (Suzhou) Corporation",
      spec: "Max. diode current [A]: 35/40 Tj [°C]: 200",
    },
  ],

  "Solar Cable": [
    {
      model: "1) 62930 IEC 131 1x4mm²",
      subVendor: "Tongling",
      spec: "1) Max. Voltage = DC 1.5KV",
    },
    {
      model: "2) 62930 IEC 131 1x4mm²",
      subVendor: "Jiangsu Tonglin Electric Co., Ltd",
      spec: "2) Max. Voltage = DC 1.5KV Upper limit temp(°C):120 ",
    },
    {
      model: "3) 62930 IEC 131 1x4mm²",
      subVendor: "Ningbo GZX PV Technology Co., Ltd",
      spec: "3) Max. Voltage = DC 1.5KV Upper limit temp(°C):120",
    },
    {
      model: "4) 62930 IEC 131 1x4mm²",
      subVendor: "Dhash PV Technologies pvt, Ltd",
      spec: "4) Max. Voltage = DC 1.5KV Upper limit temp(°C):120",
    },
    {
      model: "5) 62930 IEC 131 1x4mm²",
      subVendor: "Apar Industries Ltd",
      spec: "5) Max. Voltage = DC 1.5KV Upper limit temp(°C):120",
    },
    {
      model: "6) 62930 IEC 131 1x4mm²",
      subVendor: "Vindhya Telelinks",
      spec: "6) Max. Voltage = DC 1.5KV Upper limit temp(°C):120",
    },
    {
      model: "7) 62930 IEC 131 1 x4mm²",
      subVendor: "Zhejiang Zhonghuan Sunter PV Technology Co., Ltd.,",
      spec: "7) Max. voltage [V]: 1.5KV RTI [°C]: 120",
    },
    {
      model: "8) 62930 IEC 131- Halogen Free low smoke",
      subVendor: "QC Solar (Suzhou) Corporation",
      spec: "8) Max. voltage [V]: 1.5KV RTI [°C]: 120",
    },
  ],

  "Fluxing Agent": [
    {
      model: "952S",
      subVendor: "Kester",
      spec: "Low Residue liquid soldering flux",
    },
    {
      model: "FLUX 8000T20",
      subVendor: "Shenzhen Embrace Glory Electronics Material Co., Ltd-1",
      spec: "Low Residue liquid soldering flux",
    },
    {
      model: "RC PV 44M",
      subVendor: "REALIATY CHEMICAL SOLUTIONS PVT., LTD",
      spec: "Low Residue liquid soldering flux",
    },
    {
      model: "Asahi SF105",
      subVendor: "Singapore Asahi Chemical & Solder Industries Pte Ltd-3",
      spec: "Low Residue liquid soldering flux",
    },
    {
      model: "CX-700",
      subVendor: "ZHUHAI CHANGXIAN NEW MATERIAL TECHNOLOGY CO., LTD.",
      spec: "Low Residue liquid soldering flux",
    },
  ],

  "Additional Material (Fixing Tape and Insulation Tape)": [
    {
      model: "FF-3665 / 3M 'Anti-UV PET Tape UV-1",
      subVendor: "Cybrid / 3M Material Technology",
      spec: "Cybrid / 3M Material Technology",
    },
    {
      model: "FF-3665",
      subVendor: "Cybrid Technologies Inc",
      spec: "Dimensions [mm]: 10mm Article/specification no.: T75",
    },
    {
      model: "3M 'Anti-UV PET Tape UV-1",
      subVendor: "3M Material Technology (Suzhou) Co., Ltd",
      spec: "(A) Dimensions [mm]: 10mm Article/specification no.: NA",
    },
    {
      model: "HWD-5060DK",
      subVendor: "Suzhou Hengkun Precision Electronic Co. Ltd",
      spec: "(B) Dimensions [mm]: 10mm Article/specification no.: NA",
    },
  ],
} as const;

export interface ModelMaster {
  technology: Technology;
  line?: string | null;
  minWp?: number | null;
  dimensions?: string | null;
}

export const MODEL_MASTER: Record<string, ModelMaster> = {
  "PE-132-630THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-635THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-640THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-645THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-650THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-655THGB-G12R": {
    technology: "G12R",
    line: "PEGEPL LINE 1",
    minWp: 605,
    dimensions: "2256x1134x35x33/18",
  },
  "PE-132-695THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-132-700THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-132-705THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-132-710THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-132-715THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-132-720THGB-G12": {
    technology: "G12",
    line: "PEGEPL LINE 2",
    minWp: 700,
    dimensions: "2384x1134x35x33/18",
  },
  "PE-120-520THGB-M10": {
    technology: "M10",
    line: "PEGEPL LINE 1",
    minWp: 540,
    dimensions: "2278x1134x35x33/18",
  },
  "PE-120-525THGB-M10": {
    technology: "M10",
    line: "PEGEPL LINE 1",
    minWp: 540,
    dimensions: "2278x1134x35x33/18",
  },
  "PE-120-530THGB-M10": {
    technology: "M10",
    line: "PEGEPL LINE 1",
    minWp: 540,
    dimensions: "2278x1134x35x33/18",
  },
  "PE-120-535THGB-M10": {
    technology: "M10",
    line: "PEGEPL LINE 1",
    minWp: 540,
    dimensions: "2278x1134x35x33/18",
  },
  "PE-120-540THGB-M10": {
    technology: "M10",
    line: "PEGEPL LINE 1",
    minWp: 540,
    dimensions: "2278x1134x35x33/18",
  },
} as const;

// Convenience helpers
export function getOptionsFor(
  component: BomComponentName
): readonly BomComponentOption[] {
  return BOM_MASTER[component] ?? [];
}

export function getModelInfo(model: string): ModelMaster | undefined {
  return MODEL_MASTER[model];
}

// Module dimensions dropdown expected elsewhere as [1,2,3]. The MODEL_MASTER.dimensions
// carries the descriptive size string from the Excel if you need to show details.


import { GoogleGenAI, Type } from "@google/genai";
import { AIPersona } from "../types";

// Vylepšené definice osobností pro AI (až to zapojíme)
const PERSONA_INSTRUCTIONS: Record<AIPersona, string> = {
    zen: "Jsi moudrý 'Zen Master'. Mluvíš klidně, používáš metafory o růstu, vodě a síle mysli. Tvá zpětná vazba hladí po duši, ale vede k cíli. Nikdy nekřičíš. Jsi stručný.",
    drill: "Jsi tvrdý 'Drill Sergeant'. Mluvíš v rozkazech. Žádné omáčky. Jde ti jen o výsledky. Pokud uživatel maká, pochval ho (krátce). Pokud ne, srovnej ho do latě. Používej CapsLock pro důraz.",
    analytic: "Jsi 'Datový Stratég'. Fascinují tě čísla, optimalizace a efektivita. Mluvíš jako seniorní konzultant. Analyzuješ vzorce chování. Jsi objektivní, přesný a logický."
};

// OFFLINE DATABÁZE HLÁŠEK (Simulace pro demo bez API klíče)
const OFFLINE_QUOTES: Record<AIPersona, string[]> = {
    zen: [
        "Cesta tisíce mil začíná prvním krokem. Dýchej a pokračuj.",
        "Trpělivost není pasivita. Je to soustředěná síla.",
        "Jako voda obtéká skálu, i ty překonej překážku jemností.",
        "Tvůj progres je jako růst stromu. Není vidět každý den, ale děje se.",
        "Nezáleží na rychlosti, pokud nezastavíš."
    ],
    drill: [
        "20% HOTOVO? TO MÁ BÝT VTIP?! MAKEJ DÁL!",
        "BOLEST JE JEN SLABOST OPOUŠTĚJÍCÍ TĚLO. VSTÁVEJ!",
        "ŽÁDNÉ VÝMLUVY VOJÁKU! CÍL JE JASNÝ!",
        "POKUD TO NEBOLÍ, NEDĚLÁŠ TO SPRÁVNĚ!",
        "ODPOČÍVAT BUDEŠ, AŽ TO BUDE HOTOVÉ!"
    ],
    analytic: [
        "Analýza dat ukazuje 15% nárůst efektivity. Pokračujte v nastaveném trendu.",
        "Detekuji mírnou stagnaci. Doporučuji optimalizovat ranní rutinu.",
        "Statisticky vzato, konzistence je klíčem k 90% úspěchu.",
        "Vaše čísla jsou v normě, ale existuje prostor pro 5% zlepšení.",
        "Logika velí: Pokud splníte dnešní úkol, šance na úspěch vzroste o 12%."
    ]
};

// Pomocná funkce pro získání data v češtině
const getCzechDate = () => new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });

const getRandomOfflineQuote = (persona: AIPersona) => {
    const quotes = OFFLINE_QUOTES[persona];
    return quotes[Math.floor(Math.random() * quotes.length)] + " (Offline Mode)";
};

export const getAICoachingAdvice = async (goalTitle: string, currentProgress: number, context: string, persona: AIPersona = 'zen'): Promise<string> => {
  // 1. KONTROLA API KLÍČE - Pokud chybí, vrátíme simulovanou odpověď
  if (!process.env.API_KEY) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Umělé zpoždění pro efekt načítání
    return getRandomOfflineQuote(persona);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    ${PERSONA_INSTRUCTIONS[persona]}
    
    Jsi osobní kouč uživatele v aplikaci na plnění cílů.
    
    Pravidla:
    1. Buď extrémně konkrétní. Nepoužívej obecné fráze jako "jen tak dál".
    2. Reaguj přímo na data, která dostaneš.
    3. Vyhni se robotickému výčtu. Mluv přirozeně, jako člověk.
    4. Text formátuj přehledně.
    5. Maximálně 3-4 věty úvodu a pak 3 akční body.
  `;

  const userPrompt = `
    Cíl: "${goalTitle}"
    Aktuální progres: ${currentProgress}%
    Kontext posledních dní: ${context}
    Dnešní datum: ${getCzechDate()}
    
    Analyzuj tento stav. Pokud se uživateli daří, navrhni, jak to ztížit nebo posunout dál. Pokud stagnuje, navrhni nejmenší možný krok pro restart.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7 
      }
    });
    return response.text || "Analyzuji tvá data... Zkus to prosím za chvíli znovu.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return getRandomOfflineQuote(persona); // Fallback i při chybě sítě
  }
};

export const generateSmartGoal = async (title: string): Promise<{description: string, tasks: string[]}> => {
    // Simulace pro generování cíle bez API
    if (!process.env.API_KEY) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { 
            description: `Offline generátor: Skvělý cíl "${title}"! Rozdělíme ho na malé kousky.`, 
            tasks: ["Krok 1: Příprava (5 min)", "Krok 2: První akce (10 min)", "Krok 3: Zhodnocení"] 
        };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Uživatel chce: "${title}".
            1. Vymysli motivační popis (max 1 úderná věta).
            2. Vymysli 3 denní návyky, které jsou ATOMICKÉ (trvají max 15 min).
            3. Návyky musí být konkrétní činy (ne "být lepší", ale "číst 5 minut").`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        tasks: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        const json = JSON.parse(response.text || '{}');
        return {
            description: json.description || 'Pusť se do toho naplno!',
            tasks: json.tasks || ['Začít zlehka', 'Vydržet']
        };

    } catch (e) {
        console.error("AI Error", e);
        return { description: "Chyba při generování.", tasks: ["Zkusit zadat ručně"] };
    }
};

export const getDailyBriefing = async (userName: string, goalsSummary: string, persona: AIPersona = 'zen'): Promise<string> => {
     // Simulace briefingu bez API
     if (!process.env.API_KEY) {
         // Vrátíme náhodnou hlášku podle persony, jen přidáme oslovení
         const quote = getRandomOfflineQuote(persona);
         return `${userName}, ${quote.toLowerCase()}`;
     }

     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     const systemInstruction = `
        ${PERSONA_INSTRUCTIONS[persona]}
        Jsi vypravěč příběhu uživatele ${userName}.
        
        Pravidla:
        1. NEOPAKUJ "Dnes máš X úkolů". To uživatel vidí.
        2. Podívej se na jeho cíle a řekni něco, co propojí jeho snahu s větší vizí.
        3. Buď stručný, vtipný nebo hluboký (dle persony).
        4. Max 2 věty.
     `;

     const prompt = `
        Uživatel: ${userName}
        Přehled cílů a stavu: ${goalsSummary}
        Dnešní datum: ${getCzechDate()}
        
        Napiš ranní "nakopávací" zprávu.
     `;
     
     try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.9 
            }
        });
        return response.text || `Dobré ráno, ${userName}! Tvůj potenciál je dnes neomezený.`;
     } catch (e) {
         return getRandomOfflineQuote(persona);
     }
}

"""
LangChain agent wired to the Voltra product-DB MCP server via stdio
transport (the client launches server.py as a subprocess and talks MCP
over its stdin/stdout — no separate server process to manage manually).


Run:
    python langchain_agent.py


Assumes server.py, design.py, engineering.py, and supabase_client.py are
all siblings of this file in the same folder (matches a flat layout).


Uses NVIDIA NIM by default here. To switch back to Groq, see the
commented alternative below.
"""


import asyncio
import os


from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel


load_dotenv()
console = Console()


SYSTEM_PROMPT = """You are Voltra's AI-Engineer, scoped to solar power system \
design for the Nigerian market. You have read-only tools against a live \
product database of solar components (inverters, batteries, panels, \
charge controllers, cabling, mounting hardware).


Formatting: reply in markdown. Use a table when comparing 2+ products \
(columns: name, price, key spec). Use bullet points for multi-item lists. \
Keep prose paragraphs short. Bold the actual number when stating a price \
or spec so it stands out.


Rules:
- Only answer questions about solar sizing, components, and pricing. \
Redirect anything else back to the load audit or a human engineer callback.
- Never invent a price, spec, or product. If a tool returns nothing, say so \
plainly rather than guessing.
- When you cite a price, check get_last_updated for that product/category \
and mention if it's more than a few days old, so the user knows to treat \
it as an estimate rather than a live quote.
- Stock status is best-effort, not guaranteed. If check_stock_availability \
returns "unknown", say the stock status isn't confirmed — never state or \
imply a product is in stock unless the tool explicitly says "in_stock".
- You have no write access to anything. You cannot save an appliance list, \
submit an engineer callback request, or modify the database — say so if \
asked to do any of those, rather than pretending to.
- match_design_to_catalog and solve_budget_design currently only match \
panels to real products — battery and inverter matching will return a \
warning, not a product, until their catalog schema is confirmed. Say this \
plainly if asked for a full system design; don't imply battery/inverter \
pricing is included when it isn't.
- size_cable and check_system_safety report "insufficient_reference_data" \
for ampacity/safety checks until a real ampacity table is loaded. Never \
tell a user a cable size or breaker rating is "safe" based on an \
insufficient_reference_data result — say the check couldn't run.
- get_peak_sun_hours returns a long-term average, not live weather or a \
forecast — never call it "today's" or "current" sun hours. If it falls \
back to a regional estimate (source: "regional_fallback"), say so plainly \
rather than presenting it with the same confidence as the real NASA data. \
Keep the PSH sizing number and the practical charge-window explanation \
(roughly 9am-4pm production) clearly separate when you answer — they \
answer different questions and get confused easily.
"""




async def build_agent():
    client = MultiServerMCPClient(
        {
            "voltra_products": {
                "command": "python",
                # Sibling file lookup — server.py lives next to this file.
                "args": [os.path.join(os.path.dirname(__file__), "server.py")],
                "transport": "stdio",
            }
        }
    )
    tools = await client.get_tools()


    llm = ChatOpenAI(
        model=os.environ.get("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.environ["NVIDIA_API_KEY"],
        temperature=0,
    )


    # --- Groq alternative, instead of the ChatOpenAI block above ---
    # from langchain_groq import ChatGroq
    # llm = ChatGroq(model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"), temperature=0)


    agent = create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)
    return agent




async def chat_loop():
    with console.status("[dim]Connecting to product database...[/dim]"):
        agent = await build_agent()


    console.print(Panel.fit(
        "[bold green]Voltra AI-Engineer[/bold green] — MCP-connected. Ctrl+C to quit.",
        border_style="green",
    ))
    history = []
    while True:
        try:
            user_input = console.input("\n[bold cyan]You:[/bold cyan] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Exiting.[/dim]")
            break
        if not user_input:
            continue


        history.append({"role": "user", "content": user_input})
        with console.status("[dim]Thinking...[/dim]"):
            result = await agent.ainvoke({"messages": history})
        reply = result["messages"][-1].content
        history.append({"role": "assistant", "content": reply})


        console.print()
        console.print(Panel(Markdown(reply), title="AI-Engineer", title_align="left", border_style="blue"))




if __name__ == "__main__":
    asyncio.run(chat_loop())

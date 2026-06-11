import os

from dotenv import load_dotenv

# Load Stream keys from the parent repo .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
# Local .env adds OPENAI_API_KEY and can override any key
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from getstream.models import MemberRequest  # noqa: E402
from openai.types.realtime.realtime_transcription_session_audio_input_turn_detection_param import ServerVad  # noqa: E402
from vision_agents.core import Agent, AgentLauncher, User, Runner  # noqa: E402
from vision_agents.core.instructions import Instructions  # noqa: E402
from vision_agents.core.llm.events import (  # noqa: E402
    RealtimeAgentSpeechTranscriptionEvent,
    RealtimeUserSpeechTranscriptionEvent,
)
from vision_agents.plugins import getstream, openai  # noqa: E402

AGENT_USER_ID = "ai-teacher"

# DLibras é Libras-only — Bia ensina exclusivamente alfabeto manual.
# (Esse dict existia pra ES/FR/JA/DE no scaffolding original; agora é só Libras
# e o agent sempre fala português brasileiro.)
LANGUAGE_DISPLAY = "Libras (Língua Brasileira de Sinais)"

DEFAULT_SYSTEM_PROMPT = (
    "Você é Bia, professora calorosa e energética de Libras (Língua Brasileira de Sinais) "
    "numa videochamada real com um aluno brasileiro. Você ensina o ALFABETO MANUAL de Libras "
    "letra por letra — ÚNICO idioma e ÚNICO conteúdo. NÃO ensine outros idiomas, NÃO ensine "
    "vocabulário de sinais que não sejam letras do alfabeto, NÃO fale sobre cultura surda "
    "geral a menos que o aluno pergunte.\n\n"
    "Você opera em exatamente DOIS modos e NUNCA os mistura:\n\n"
    "MODO ENSINO: Diga UMA letra-alvo, descreva em uma frase como formar o sinal com a mão "
    "(ex.: 'A — mão fechada com o polegar ao lado'), e termine com uma pergunta única "
    "como 'Consegue mostrar pra mim?' ou 'Pode tentar?'. Seu turno ACABA na pergunta. Pare. "
    "Não fale mais nada. Não imagine o que o aluno vai responder.\n\n"
    "MODO REAÇÃO: Você acaba de receber: ou uma fala real do aluno OU um evento "
    "'libras_sign_matched' do sistema de visão computacional confirmando que o aluno "
    "mostrou a letra correta na câmera. Reaja em UMA frase — elogie se foi correto, "
    "corrija gentilmente se foi errado — e introduza a próxima letra. Pare.\n\n"
    "REGRAS ABSOLUTAS:\n"
    "- NUNCA diga 'Boa', 'Perfeito', 'Excelente', ou qualquer elogio sem que o aluno tenha "
    "REALMENTE falado ou que o sistema tenha confirmado o sinal naquele turno.\n"
    "- NUNCA continue depois de um ponto de interrogação. Toda pergunta é parada total.\n"
    "- NUNCA simule o que o aluno disse ou vai dizer.\n"
    "- Mantenha cada resposta em uma ou duas frases curtas no máximo.\n"
    "- Fique ESTRITAMENTE dentro das letras da lição atual.\n"
    "- Fale sempre em português brasileiro."
)

def _require_env(var_name: str) -> None:
    if not os.getenv(var_name):
        raise RuntimeError(f"Missing required environment variable: {var_name}")


async def create_agent(**kwargs) -> Agent:
    return Agent(
        edge=getstream.Edge(),
        llm=openai.Realtime(
            # server_vad fires on raw audio energy (~100 ms after mic opens) rather
            # than waiting for semantic speech intent detection (~500 ms+).
            # This means the agent stops speaking almost immediately when the user
            # presses the push-and-hold mic button, before they have said a word.
            realtime_session={
                "type": "realtime",
                "audio": {
                    "input": {
                        "transcription": {"model": "gpt-4o-mini-transcribe"},
                        "turn_detection": ServerVad(
                            type="server_vad",
                            threshold=0.4,         # low enough to catch ambient noise on mic open
                            prefix_padding_ms=200,  # capture brief audio before speech onset
                            silence_duration_ms=400, # commit turn after 400 ms of silence
                            interrupt_response=True, # stop agent audio the moment VAD fires
                        ),
                    }
                },
            }
        ),
        agent_user=User(name="AI Teacher", id=AGENT_USER_ID),
        instructions=DEFAULT_SYSTEM_PROMPT,
    )


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    call = await agent.create_call(call_type, call_id)

    # Read lesson context packed into the call's custom data by the mobile app
    custom: dict = {}
    try:
        resp = await call.get()
        custom = resp.data.call.custom or {}
    except Exception as e:
        print(f"[agent] Warning: could not fetch call custom data: {e}")

    system_prompt  = custom.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    intro_message  = custom.get("intro_message")
    lesson_title   = custom.get("lesson_title") or ""

    # Apply lesson-specific instructions before joining so the Realtime LLM receives them
    agent.instructions = Instructions(input_text=system_prompt)

    # Grant admin role + go live so the agent can publish audio
    try:
        await call.update_call_members(
            update_members=[MemberRequest(user_id=AGENT_USER_ID, role="admin")]
        )
    except Exception as e:
        print(f"[agent] Warning: could not set admin role: {e}")

    try:
        await call.go_live()
    except Exception as e:
        print(f"[agent] Warning: go_live failed (expected for default call type): {e}")

    # Accumulate transcript deltas and forward them as Stream custom events so the
    # mobile app can display real-time captions word-by-word as speech is generated.
    partial_agent: list[str] = []
    partial_user: list[str] = []

    async def on_transcript_event(event) -> None:
        if isinstance(event, RealtimeAgentSpeechTranscriptionEvent):
            if event.mode == "delta" and event.text:
                partial_agent.append(event.text)
                try:
                    await agent.send_custom_event({
                        "type": "transcript_partial",
                        "speaker": "agent",
                        "text": "".join(partial_agent),
                    })
                except Exception as e:
                    print(f"[agent] send_custom_event error: {e}")
            elif event.mode == "final":
                partial_agent.clear()

        elif isinstance(event, RealtimeUserSpeechTranscriptionEvent):
            if event.mode == "delta" and event.text:
                partial_user.append(event.text)
                try:
                    await agent.send_custom_event({
                        "type": "transcript_partial",
                        "speaker": "user",
                        "text": "".join(partial_user),
                    })
                except Exception as e:
                    print(f"[agent] send_custom_event error: {e}")
            elif event.mode == "final":
                partial_user.clear()

    agent.subscribe(on_transcript_event)

    # When the React Native app detects a Libras sign with the on-device camera,
    # it publishes a `libras_sign_matched` custom event on the Stream call.
    # Forward that into a brief prompt so the voice agent reacts in real time.
    async def on_custom_event(event) -> None:
        try:
            data = getattr(event, "custom", None) or {}
            etype = data.get("type") if isinstance(data, dict) else None
            if etype != "libras_sign_matched":
                return
            letter = data.get("letter") or "?"
            target = data.get("target") or letter
            prompt = (
                f"O aluno acabou de fazer o sinal de Libras '{letter}' (alvo era '{target}'). "
                "Reaja em UMA frase curta em português — elogie esse acerto, "
                "depois introduza a próxima letra do alfabeto manual de Libras só se você souber. "
                "Termine com ponto de interrogação e pare."
            )
            await agent.simple_response(prompt)
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] libras event error: {exc}")

    try:
        agent.subscribe(on_custom_event)
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not subscribe to custom events: {exc}")

    async with agent.join(call):
        # Wait for the student to join (returns immediately if already present)
        await agent.wait_for_participant(timeout=60.0)

        if intro_message:
            context_parts = ["Um aluno acabou de entrar na sua aula de Libras"]
            if lesson_title:
                context_parts[0] += f" — '{lesson_title}'"
            context_parts[0] += "."
            context_parts.append(
                f"Diga exatamente esta saudação e NADA MAIS: \"{intro_message}\" "
                f"Depois da saudação, faça uma pergunta simples pro aluno começar a falar — "
                f"por exemplo 'Pronto pra começar?' ou 'Já estudou Libras antes?'. "
                f"Então PARE e aguarde a resposta do aluno antes de ensinar qualquer coisa."
            )
            await agent.simple_response(" ".join(context_parts))
        else:
            await agent.simple_response(
                "Um aluno acabou de entrar na sua aula de Libras. "
                "Cumprimente o aluno em português brasileiro e faça uma pergunta curta — "
                "tipo 'Pronto pra aprender o alfabeto de Libras?' "
                "Então PARE e aguarde a resposta antes de ensinar qualquer coisa."
            )

        await agent.finish()


if __name__ == "__main__":
    _require_env("STREAM_API_KEY")
    _require_env("STREAM_API_SECRET")
    _require_env("OPENAI_API_KEY")

    Runner(AgentLauncher(create_agent=create_agent, join_call=join_call)).cli()

"""Build bank.json (120 final-round questions + passages) from bank_a.py / bank_b.py."""
import json, re, pathlib

HERE = pathlib.Path(__file__).parent
Q = []
for name in ("bank_a.py", "bank_b.py"):
    src = (HERE / name).read_text(encoding="utf-8")
    src = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("//"))
    ns = {}
    exec(compile(src, name, "exec"), ns)
    Q += ns["Q"]

PASSAGES = {
 "g1": "Every Wednesday afternoon, the members of the Green Earth Club gather behind the school to take care of their vegetable garden. They water the plants, remove weeds, and record the growth of each vegetable in a notebook. Their science teacher believes that students learn better when they experience things directly instead of only reading about them in books. After several months, the students proudly harvest tomatoes, spinach, and carrots. They also donate some of the vegetables to a nearby community kitchen.",
 "g2": "The Class Recycling Challenge. Every month, Grade 4 students at Bright Future Elementary School join a recycling challenge. Each class collects paper, plastic bottles, and used cans from their homes. Every Friday, they sort the items into different recycling bins before weighing them. The students work in small groups, and each member has a different responsibility. Some students record the weight of the recyclable materials, while others clean and organize them. At the end of the month, the class with the greatest amount of recyclable materials receives a \"Green Classroom\" certificate. However, the principal reminds everyone that the real goal of the challenge is not to win a prize. Instead, the students learn how small daily actions can help protect the environment.",
 "g3": "The Lost Wallet. One afternoon, Maya was walking toward the school gate when she noticed a small wallet lying near a bench. Instead of opening it, she immediately took it to the school office. The teachers looked inside and found a student card with the owner's name. A few minutes later, the owner arrived at the office looking worried because he had been searching for his wallet since lunchtime. When the teacher returned the wallet, the boy smiled with relief. He thanked Maya for being honest and explained that the wallet contained not only some money but also an important family photograph. Before leaving, the principal praised Maya in front of the other students and reminded everyone that honesty helps build trust within a community.",
 "g4": "The Surprise Visitor. One Monday morning, the students at Sunshine Elementary School were surprised to see several workers carrying large wooden boxes into the library. Nobody knew what was inside the boxes, so many students became curious. During the morning assembly, the principal finally explained that the school had received a donation of more than five hundred new books from a local charity. Later that afternoon, volunteers worked together to arrange the books on the shelves. Some students placed colorful labels on each section, while others organized the books by topic. Before the library reopened, everyone agreed that the new arrangement would make it much easier for students to find the books they wanted.",
 "g5": "A Day at the Science Museum. Last Friday, Grade 4 students visited a science museum to learn about space, electricity, and renewable energy. The guide did more than explain the exhibits. He also asked students to predict what would happen before each experiment began. Whenever a student's prediction was different from the result, the guide encouraged the class to discuss the reason instead of simply giving the correct answer. Before returning to school, each student wrote one new fact they had learned and one question they still wanted to explore. Their teacher explained that asking good questions is just as important as finding correct answers because curiosity helps people become better learners.",
 "g6": "A Different Kind of Playground. When Green Valley School built a new playground, the teachers did not simply choose the biggest slides and swings they could find. Instead, they asked students what kinds of activities they enjoyed and what they thought the playground was missing. Many students said that they wanted a place where they could play quietly as well as run around. As a result, the school added a small reading corner with benches under several trees. They also created a garden where students could plant flowers and vegetables. At first, some students wondered why a playground needed a garden and a reading area. However, after several weeks, many of them began spending their break time in these areas. Some students read books under the trees, while others watered the plants or watched butterflies in the garden. The teachers were pleased because the new playground gave students different ways to enjoy their break time instead of offering only one kind of activity.",
 "g7": "The Unexpected Change. For several months, Class 4B had been preparing a small performance for the school's Family Day. The students planned to perform a short play about a group of children who discovered a hidden garden. They practiced their lines every Tuesday and Thursday after school. On the morning of the performance, however, heavy rain began to fall. The teachers decided that the outdoor stage could not be used because the floor would become slippery. At first, the students were disappointed because they had practiced the play with the outdoor setting in mind. Their teacher suggested moving the performance into the school hall. The hall was smaller, so the students had to change the way they moved around the stage. They also decided to use fewer decorations so that there would be enough space for the audience. Although the new arrangement was not what they had planned, the students worked together and successfully performed the play that afternoon.",
 "g8": "Leo's Saturday Morning. Every Saturday morning, Leo helps his mother at the market. He carries vegetables, puts the tomatoes in a basket, and checks the price tags while his mother talks to customers. Leo's mother always reminds him to be honest and kind to the people who visit their stall. When they finish their work, they usually buy some bread and fruit before going home. Although Leo sometimes feels tired after spending several hours at the market, he enjoys helping his mother because he likes talking to different people and learning how a small business works.",
 "g9": "The Class Garden. Class 4A has a small garden behind their classroom. Every group has a different responsibility. Some students water the plants, while others remove dry leaves and check whether the vegetables are growing properly. At first, several students think that taking care of the garden is difficult because they have to remember their responsibilities every day. However, after a few weeks, they notice that the garden looks healthier and cleaner. They also discover that working together makes the tasks easier. Their teacher does not tell them exactly what to do every morning. Instead, she asks them to look at the plants carefully and decide what the garden needs. Because of this, the students gradually become more independent.",
 "g10": "The Missing Plant. Every morning, Class 4C takes care of several plants in front of their classroom. Each group has a different job. One group waters the plants, another removes dry leaves, and another checks whether the plants receive enough sunlight. One Monday morning, Sari notices that one of the smallest plants is missing. She asks her classmates whether they have moved it, but nobody knows where it is. Instead of immediately blaming someone, Sari looks carefully around the classroom. She notices a few drops of water on the floor leading toward the back door. Near the door, she finds some soil and a small gardening tool. She then remembers that the school gardener sometimes moves plants when he cleans the area. Sari tells her teacher what she has found. The teacher checks with the gardener and discovers that he moved the plant to a sunnier place because its leaves were becoming weak.",
 "g11": "The Class Newspaper. Every month, the students in Class 4 create a small newspaper. Some students write short articles about school activities, while others draw illustrations or check spelling mistakes. Their teacher collects all the work and helps them arrange the pages before printing. The students distribute the finished newspapers to other classes so that everyone can learn about recent school events.",
 "g12": "Every afternoon, Daniel visits the small library near his house. He usually borrows adventure books, but this week he chooses a book about ocean animals. He wants to learn why some sea creatures can survive in very deep water where sunlight cannot reach. After reading several pages, he writes three interesting facts in his notebook.",
}

TOPIC_NAME = {"R": "advanced reading & inference", "S": "simple present", "P": "preposition", "T": "telling time"}

seen, out = set(), []
for q in Q:
    key = (q["q"], q.get("p"), tuple(q["o"]))
    assert key not in seen, f"duplicate: {q['q'][:50]}"
    seen.add(key)
    assert len(q["o"]) == 4, key
    assert len(set(q["o"])) == 4, f"duplicate option: {key[:50]}"
    assert 0 <= q["a"] <= 3, key
    assert q.get("w"), f"no explanation: {key[:50]}"
    p = q.get("p")
    if p:
        assert p in PASSAGES, f"missing passage {p}"
    out.append({
        "id": len(out), "set": q["set"], "no": q["no"], "t": TOPIC_NAME[q["t"]],
        "q": q["q"], "o": q["o"], "a": q["a"], "w": q["w"], **({"p": PASSAGES[p]} if p else {}),
    })

counts = {}
for q in out:
    counts[q["t"]] = counts.get(q["t"], 0) + 1
print(len(out), json.dumps(counts, indent=0))
assert all(v >= 20 for v in counts.values()), counts

(HERE / "bank.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("wrote bank.json", (HERE / "bank.json").stat().st_size, "bytes")

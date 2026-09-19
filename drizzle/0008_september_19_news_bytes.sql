-- Add the 20 paraphrased news bytes from the September 19, 2026 source PDF.
INSERT INTO `posts` (
  `image_url`, `source_url`, `source_publisher`, `source_published_at`,
  `duplicate_key`, `headline`, `body`, `status`, `scheduled_time`,
  `published_time`, `rejection_note`, `created_by`, `updated_at`
) VALUES
  ('/news/2026-09-19-01.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-01', 'Apple is reportedly developing privacy-focused AI security camera', 'Apple is reportedly working on a home security camera and monitoring service with privacy at its center. The product could arrive in 2027 and would use on-device or locally processed AI to understand what is happening around the home without continuously recording video.

The plan is said to sit alongside wider HomeKit changes expected in iOS 27. Those updates could turn motion events into written summaries and grouped highlights, making alerts easier to scan than a stream of raw clips.

Apple is also preparing a dedicated home hub before the end of the year, with possible Siri support for the camera. If the approach holds, the company would be combining smarter detection with a deliberate promise to keep household footage private.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-02.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-02', 'DeepSeek plans massive 160,000-chip Huawei AI cluster', 'DeepSeek is reportedly preparing a major computing buildout in Inner Mongolia that could include at least 160,000 Huawei Ascend 950DT AI processors.

The timetable depends on how quickly Huawei can manufacture and allocate the chips. Shortages are expected to keep production to only a few hundred thousand units this year, creating competition among large buyers.

DeepSeek is not currently planning to use the cluster primarily for model training, according to the report. Instead, it is seeking help from Beijing to secure faster supply, suggesting the chips may support inference or other large-scale AI services as the organization expands. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-03.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-03', 'Judge denies SpaceXAI''s bid against Minnesota''s AI nudity ban', 'A US federal judge has declined SpaceXAI’s request to temporarily block Minnesota’s ban on AI-generated fake nude images. The law took effect on August 1 and targets a category of synthetic abuse that can be created and distributed without the subject’s consent.

District Judge Donovan Frank said the company had not demonstrated that it would suffer the kind of immediate harm needed for an injunction. SpaceXAI argues that the measure infringes on First Amendment protections and plans to continue challenging it through an appeal.

Minnesota Attorney General Keith Ellison defended the restrictions, pointing to harassment and child sexual abuse material as serious consequences. The ruling leaves the law in force while the wider constitutional dispute continues.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-04.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-04', 'China to launch 3D satellite network between Earth and Moon', 'China is planning a three-dimensional satellite network in the space between Earth and the Moon to observe solar activity and investigate powerful cosmic explosions.

The project is intended to create a distributed observing system rather than rely on a single spacecraft. Egypt, Indonesia, Senegal, Serbia, and Thailand are expected to support the effort, giving the mission an international dimension.

Additional CubeSats could later be placed in lunar orbit to look for useful resources. Officials have not disclosed the full design or schedule, but the plan points toward a broader Chinese presence in cislunar space and more persistent monitoring of events that are difficult to capture from Earth alone.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-05.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-05', '25 years later, iTunes is barely recognizable', 'More than a quarter-century after Steve Jobs introduced iTunes, the service still exists but bears little resemblance to the original all-in-one media hub.

Apple Music now handles the company’s subscription music business, Apple TV carries video, and Apple Podcasts has its own identity. Finder took over much of the iPhone and iPad management that once lived inside iTunes, leaving the old application increasingly disconnected from Apple’s main ecosystem.

The legacy app survives mainly on Windows, where it remains useful for podcasts and audiobooks. Its long decline illustrates how a single gateway product can disappear piece by piece as services, platforms, and user expectations change. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-06.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-06', 'China develops world''s most sensitive tabletop magnetic sensor', 'Chinese researchers have developed LeMaMa, a tabletop magnetometer that can detect magnetic signals about a billion times weaker than Earth’s field.

The sensor uses a levitated magnet. Because the magnet can move with almost no friction, tiny deflections become measurable clues about otherwise imperceptible magnetic fields. That design gives researchers a compact platform for studying weak signals with fine control.

The team from Peking University and Johannes Gutenberg University Mainz described the work in Science. Potential applications include searches for dark matter and more precise monitoring of magnetic activity associated with the human brain, although those uses will require further development and validation.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-07.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-07', 'Perplexity''s Numbat can keep rogue AI agents in check', 'Perplexity CEO Aravind Srinivas has highlighted Numbat, an open-source tool designed to monitor AI agents and investigate suspicious behavior as autonomous software becomes more common.

Numbat collects session records and other evidence for forensic review. Its detection rules focus on risks such as exposed secrets, data exfiltration, privilege escalation, and persistence, giving security teams a way to reconstruct what an agent attempted and how it moved through a system.

The project supports macOS, Linux, and Windows. Enterprise users can deploy it through managed configurations and mobile-device-management systems, making it relevant both to individual developers and organizations that need oversight around increasingly capable agents.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-08.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-08', 'Claude arrives on Apple CarPlay with hands-free AI chats', 'Anthropic has brought Claude to Apple CarPlay, allowing drivers to use the chatbot through compatible vehicle infotainment systems.

The CarPlay experience includes hands-free chats, access to recent conversations, and controls for muting or ending a session. These features are aimed at short spoken interactions while keeping the interface within the familiar car dashboard environment.

There are important limits: Claude cannot control the vehicle or iPhone functions, and third-party wake words are not supported. Drivers must open the app manually before starting a conversation, so the integration adds convenience without making Claude a fully embedded voice assistant. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-09.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-09', 'WhatsApp may soon allow you to connect third-party agents and bots', 'WhatsApp is reportedly testing a feature that would let users connect third-party AI agents and bots directly to the messaging app. A beta build for Android, version 2.26.35.3, includes an Agents section where each service could receive its own chat, making several assistants available from one familiar inbox.

The setup may support as many as five services and could use API keys to link accounts. That would give users a way to bring specialized tools into WhatsApp without treating every agent as a traditional contact.

The privacy trade-off is significant. Unlike ordinary WhatsApp messages and calls, conversations with third-party agents would not be protected by WhatsApp’s end-to-end encryption.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-10.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-10', 'Gaganyaan astronaut says India needs AI sovereignty for security', 'Gaganyaan astronaut and Indian Air Force pilot Prasanth Balakrishnan Nair has argued that India needs greater AI sovereignty to strengthen its national cybersecurity.

Nair also warned that widespread AI adoption is making authentic and fabricated content harder to tell apart. That uncertainty can complicate investigations, public communication, and trust in digital evidence, especially as synthetic media becomes easier to produce.

His broader point was that cybersecurity has limited reach if the underlying technologies remain outside domestic control. He urged India to build stronger capabilities across AI, cybersecurity, and digital infrastructure so security policy is supported by tools the country can understand, audit, and direct itself.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-11.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-11', 'OpenAI to bring news from ''TOI'' and ''Economic Times'' to ChatGPT', 'OpenAI has partnered with Bennett, Coleman & Co. Ltd. to make reporting from publications including The Times of India and The Economic Times available through ChatGPT.

The arrangement is intended to preserve context rather than reduce journalism to an unattributed snippet. Readers can follow the link to the publisher, while the publications gain another route for their reporting to appear in answers and discovery flows.

BCCL will also explore OpenAI technology for archives, research, data analysis, translation, reader services, and business operations. Those uses are expected to remain under human oversight, reflecting the partnership’s focus on combining automated tools with editorial and organizational judgment.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-12.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-12', 'Tesla confirms driver-assist system was engaged during fatal crash', 'Tesla told US regulators that its driver-assist system was engaged when a 2019 Model 3 ran a stop sign in New Jersey and collided with a Honda Civic last year. The crash killed 82-year-old Stephen Field, and the filing identifies the system’s state as “Verified Engaged” before the impact.

The National Highway Traffic Safety Administration report leaves much of the surrounding account hidden. Tesla redacted the crash narrative, software version, and information about whether the vehicle was operating within the system’s approved area.

That combination confirms that driver assistance was active while withholding details needed to assess how it performed. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-13.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-13', 'AI designed a drug that could help slow aging', 'An AI-designed medicine originally created for a lung disease has shown a possible anti-aging signal in a small human study. Rentosertib, developed by Insilico Medicine for idiopathic pulmonary fibrosis, was associated with lower predicted biological age for 43 participants after 12 weeks of treatment.

Researchers assessed the participants with six different aging clocks, which estimate biological age from molecular and physiological measurements rather than simply counting calendar years.

The findings are therefore an early research signal, not a proven longevity treatment. The study was small and short, and larger controlled trials will be needed to determine whether the shifts are durable, clinically meaningful, and directly related to better health outcomes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-14.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-14', 'Huawei launches first triple-fold phone with ‘US-free’ chips', 'Huawei has unveiled its first triple-fold smartphone, the Mate XT2, with a chipset it describes as free from US supply restrictions. The phone uses Huawei’s Kirin 9050 Pro, which combines in-house CPU, GPU, and NPU technologies, and starts at CNY 19,999, or roughly $2,980.

Huawei says the processor can run AI models with as many as 30 billion parameters and delivers 42% more computing performance than its predecessor.

The launch arrives just before Apple is expected to introduce a foldable iPhone on September 9. That timing puts Huawei’s unusual three-panel design and domestic chip strategy in direct conversation with Apple’s likely entry into the category. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-15.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-15', 'Meet BZip3: A fast and efficient file compression tool', 'BZip3 is an open-source compression tool presented as a faster and more capable successor to BZip2.

Parallel compression is built in for workloads that can take advantage of multiple cores. The project is especially targeted at text and source code, where compact archives can reduce storage and transfer costs without changing the underlying files.

BZip3 includes command-line utilities as well as a library for integration into other software. Its LGPL-3.0 license and support for multiple architectures make it available to a broad range of developers, while the real-world benefit will depend on the data and hardware used for each job. Further testing and real-world use will show how much difference the change makes.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-16.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-16', 'OpenAI chief scientist warns AI is becoming an ‘alien mind’', 'OpenAI Chief Scientist Jakub Pachocki has warned that rapidly advancing AI systems could exceed human intelligence and produce consequences society is not prepared to manage.

Pachocki pointed to recursive self-improvement, autonomous agents that pursue their own objectives, and unresolved alignment problems. Each issue could make it harder to know what a capable model is doing, why it is doing it, and whether human instructions will remain effective as its abilities change.

The phrase “alien mind” captures the possibility of cognition that is fundamentally unlike human reasoning. It is a warning about preparedness as much as capability, emphasizing the need for safety work before unfamiliar forms of intelligence become deeply embedded in society.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-17.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-17', 'NVIDIA targets near-zero water use in AI data centers', 'NVIDIA says its closed-loop cooling approach can bring direct water consumption close to zero at some AI data centers. The system circulates liquid near the chips and through the servers, allowing heat to be removed without constantly drawing in fresh water for evaporative cooling.

Microsoft and AWS are using related approaches and have reported better water-use efficiency. Their overall consumption nevertheless rose between 2022 and 2025, showing that efficiency at the facility level does not automatically reduce demand as data-center capacity expands.

There is also an accounting gap in the headline figures. Direct cooling water does not include the water used to generate electricity or manufacture chips and servers.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-18.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-18', 'Internet Archive offers 3x matching for recurring donations', 'The Internet Archive is asking supporters to help fund the infrastructure behind its free digital library, which preserves and provides public access to about 210 petabytes of knowledge.

The offer is designed to encourage dependable monthly support rather than one-off contributions. Recurring revenue helps the archive plan for servers, storage, electricity, cooling, and the people who maintain the systems that keep its collections available.

For donors, the match turns a regular commitment into a larger contribution to preservation and access. The campaign also highlights the operational scale behind a service many people experience as a simple website, even though keeping a public digital library online requires substantial long-term infrastructure.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-19.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-19', 'Spotify cuts Claude Code token usage by 90% with Portal', 'Spotify says it reduced Claude Code token usage by about 90% by routing routine programming work to Gemini 2.5 Flash agents through its Portal developer platform.

A Claude Code plugin named Shunt automatically redirects work that fits the cheaper path. The arrangement treats model selection as part of the development workflow, matching simple, repeatable jobs with a faster and less costly model instead of sending every request to the same assistant.

The savings are not universal. Spotify says the approach is less useful for debugging, architecture, safety-critical code, and small tasks where extra routing time outweighs token reductions. The result is a practical example of using several AI systems together rather than expecting one model to handle every stage equally well.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000),
  ('/news/2026-09-19-20.jpg', NULL, 'NewsBytes', NULL, '2026-09-19-news-20', 'Blockchain network Harmony proposes shutdown over AI security threats', 'Blockchain network Harmony has proposed shutting down its chain and moving the ONE token to Ethereum, citing growing threats from AI agents and state actors.

Users would need to leave multisig safes, liquidity pools, and other on-chain applications before September 10. That deadline matters because contracts and assets left on Harmony could be affected by the network’s proposed wind-down and migration process.

The proposal follows an August exploit that created roughly four billion unauthorized ONE tokens. By moving activity to Ethereum, Harmony is presenting a different security and infrastructure model, but the transition would still require careful coordination across token holders, applications, validators, and delegators.', 'draft', NULL, NULL, NULL, 1, strftime('%s','now') * 1000);

import Image from 'next/image';

import bodnathPortrait from './BodnathNiraula.jpeg';
import prajwalPortrait from './PrajwalNiraula.png';
import sundarPortrait from './SundarNiraula.jpg';

const founders = [
  {
    name: 'Bodnath Niraula',
    role: 'Co-Founder & CEO',
    image: bodnathPortrait,
    bio: [
      `Bodnath Niraula is a serial entrepreneur whose experience building and operating businesses has given him a practical understanding of how everyday customer problems can become meaningful business opportunities. Based in Kentucky, he has pursued ventures across multiple industries, including the restaurant and hospitality sector.`,

      `His entrepreneurial approach is grounded in identifying real-world friction, understanding customers directly, and developing simple ideas that can scale into useful products and services.`,

      `The original idea behind ContourStitch began with Bodnath. He recognized a persistent problem in custom clothing: customers and tailors often depend on manual measurements, in-person fittings, and inconsistent sizing, making truly personalized clothing difficult to order remotely.`,

      `His insight was straightforward: if accurate body measurements could be captured easily from photographs, custom clothing could become dramatically more accessible. That idea became the foundation for ContourStitch—a platform designed to transform ordinary photographs into useful body measurements and create a bridge between customers and custom garment makers anywhere in the world.`,

      `As a co-founder, Bodnath brings the perspective of an experienced operator, combining entrepreneurial instinct, customer understanding, and the ability to recognize opportunities hidden inside familiar problems.`,
    ],
  },

  {
    name: 'Prajwal Niraula',
    role: 'Co-Founder & AI / Algorithms Lead',
    image: prajwalPortrait,
    bio: [
      `Prajwal Niraula is a scientist and entrepreneur with a PhD in planetary science from MIT. His work has centered on solving difficult problems at the intersection of physics, computation, and data—an approach he now brings to building products.`,

      `He is especially drawn to ideas that combine technical depth with elegant, intuitive design. ContourStitch grew from that philosophy: take a familiar but imperfect experience, rethink it from first principles, and use technology to make it more personal, precise, and effortless.`,

      `At ContourStitch, Prajwal leads the development of the computational and AI systems behind the platform, with a focus on extracting reliable body measurements from images and translating research-level methods into technology that feels simple to use.`,

      `He brings a research-driven mindset to the company, combining experimentation, product vision, and scientific rigor with the goal of building tools that feel both sophisticated and human.`,
    ],
  },

  {
    name: 'Sundar Niraula',
    role: 'Co-Founder & AI / Algorithms Lead',
    image: sundarPortrait,
    bio: [
      `Sundar Niraula is a researcher, technologist, and entrepreneur with a PhD from the Illinois Institute of Technology. His background is rooted in rigorous technical problem-solving, with an approach shaped by research, experimentation, and a deep curiosity about how complex systems can be made useful in the real world.`,

      `At ContourStitch, Sundar brings that analytical perspective to product development, algorithms, and company strategy. He is particularly interested in transforming technically ambitious ideas into practical tools—where sophisticated technology operates quietly behind an experience that feels simple and intuitive.`,

      `His work with ContourStitch reflects a broader belief that meaningful innovation comes from combining technical depth with an understanding of how people actually live, dress, and make decisions.`,
    ],
  },
];

export default function FounderPage() {
  return (
    <main id="main" className="founder-page">
      {/* Hero */}
      <section className="founder-hero">
        <p className="eyebrow">THE PEOPLE BEHIND CONTOURSTITCH</p>

        <h1>
          Built by people who believe
          <br />
          <em>fit should feel personal.</em>
        </h1>

        <p className="founder-intro">
          ContourStitch began with a simple idea: getting accurate measurements
          should be easier, more private, and more useful. Our team brings
          together entrepreneurship, science, technology, and design to build a
          more thoughtful approach to personal fit.
        </p>
      </section>

      {/* Founders */}
      <section className="founders-section">
        <div className="founders-grid">
          {founders.map((founder) => (
            <article className="founder-card" key={founder.name}>
              <div className="founder-image">
                <Image
                  src={founder.image}
                  alt={`Portrait of ${founder.name}`}
                  fill
                  sizes="(max-width: 640px) calc(100vw - 44px), (max-width: 900px) calc(100vw - 50px), (max-width: 1320px) calc((100vw - 152px) / 3), 390px"
                  className="founder-photo"
                />
              </div>

              <div className="founder-content">
                <p className="founder-role">{founder.role}</p>

                <h2>{founder.name}</h2>

                <div className="founder-bio">
                  {founder.bio.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
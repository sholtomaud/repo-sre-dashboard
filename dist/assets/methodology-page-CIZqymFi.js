import{h as e,n as t,r as n,t as r}from"./index-Cze6PZ7Z.js";import{c as i}from"./metrics-CGSTutjD.js";var a=`<main class="doc">
  <p class="eyebrow">Methodology</p>
  <h1>How the numbers are calculated</h1>
  <section class="why" data-why hidden>
    <h2>Why this repository?</h2>
    <p data-why-text></p>
    <p data-why-source hidden>
      <a data-why-link target="_blank" rel="noopener noreferrer">Source</a>
    </p>
  </section>

  <p class="lede">
    Every number on the dashboard comes from files that a GitHub Actions
    workflow rebuilds <span data-schedule>on a schedule</span>, chiefly
    <a data-csv-link target="_blank" rel="noopener noreferrer"
      ><code>data.csv</code></a
    >, from the issues of
    <a data-tracked-link target="_blank" rel="noopener noreferrer"></a>. The
    workflow runs
    <a data-project-link target="_blank" rel="noopener noreferrer"
      >Repo SRE Dashboard</a
    >, a GitHub Action, and publishes this page to the repository's GitHub
    Pages.
  </p>

  <section>
    <h2>The data</h2>
    <p>
      Each row is a UTC day, and each column is a running total as of the end of
      that day:
    </p>
    <dl>
      <div>
        <dt><code>open</code></dt>
        <dd>Issues open on that day.</dd>
      </div>
      <div>
        <dt><code>agent_closed</code></dt>
        <dd>
          Issues closed so far by an AI agent: a GitHub <em>Bot</em> account, a
          login containing a word such as <code>agent</code>, <code>bot</code>,
          <code>copilot</code>, <code>claude</code> or <code>codex</code>, or a
          login listed in the Action's <code>agent-logins</code> input.
        </dd>
      </div>
      <div>
        <dt><code>human_closed</code></dt>
        <dd>Issues closed so far by anyone else.</dd>
      </div>
    </dl>
    <p>
      Pull requests are not counted. The newest row is the day in progress: it
      is rewritten on every run, and rates count it as the part of a day that
      has passed, not a whole one.
    </p>
  </section>

  <section>
    <h2>The Developer Doomsday Clock</h2>
    <p class="formula">
      Hours to midnight = (1 − combined agent resolution share) × 24
    </p>
    <p>
      The <strong>agent resolution share</strong> of a queue is the fraction of
      its resolved issues that an AI agent resolved. The clock runs over one day
      on a 24-hour dial. At 0% it reads 00:00, the start of the day, with a full
      24 hours to go; every 1% of agent share moves it on about 14 minutes. At
      100% it reaches 24:00, the midnight that ends the day, and human engineers
      have been replaced on this project.
    </p>
    <ul>
      <li>
        <strong>Safe</strong>: more than 18 hours to midnight (before 06:00;
        agent share under 25%).
      </li>
      <li><strong>Elevated</strong>: 12 to 18 hours (06:00 to noon).</li>
      <li><strong>Severe</strong>: 4 to 12 hours (after noon, to 20:00).</li>
      <li><strong>Critical</strong>: 4 hours or less (after 20:00).</li>
    </ul>
  </section>

  <section data-queue-only>
    <h2>Two queues</h2>
    <p>
      This repository keeps a second, file-based queue of issues alongside its
      GitHub issues, so the clock, the large dial and the top doom loop combine
      the two. Moving the weighting slider to "Public issues only" shows the
      GitHub issues alone.
    </p>
  </section>

  <section data-queue-only>
    <h2>How the two queues are combined</h2>
    <p>
      Each combined figure is worked out for each queue separately and then
      weighted. With <em>w</em> the weight of the public issues:
    </p>
    <ul>
      <li>
        <strong>Clock and agent resolution share</strong>: <em>w</em> × public
        share + (1 − <em>w</em>) × agents' queue share.
      </li>
      <li>
        <strong>Velocity dial</strong>: the same weighted average of the two
        queues' daily rates.
      </li>
      <li>
        <strong>Doom loop</strong>: the weighted geometric mean of the two
        ratios, so that 2× in one queue and ½× in the other average to
        break-even.
      </li>
    </ul>
    <p>
      The default is <strong>equal weight per queue</strong> (<em>w</em> = 50%).
      The agents' queue holds about 13 times as many issues as the public one,
      so adding the two together would let the agents' self-filed list drown out
      what users report. Equal weight treats each queue as one obligation. The
      slider's marks show the alternatives:
    </p>
    <dl>
      <div>
        <dt>Public issues only</dt>
        <dd><em>w</em> = 100%. This is version 1.</dd>
      </div>
      <div>
        <dt>Equal per queue</dt>
        <dd><em>w</em> = 50%. The default, used for the published clock.</dd>
      </div>
      <div>
        <dt>By backlog size</dt>
        <dd>
          <em>w</em> = the public issues' share of all open issues: weighting by
          demand.
        </dd>
      </div>
      <div>
        <dt>By actual effort</dt>
        <dd>
          <em>w</em> = the public issues' share of all resolutions per day, by
          agents and humans together: the weighting the project's own behaviour
          implies.
        </dd>
      </div>
      <div>
        <dt>Agents' queue only</dt>
        <dd><em>w</em> = 0%.</dd>
      </div>
    </dl>
    <p>
      The effort-based weight is not the default because it would grade the
      project by its own priorities: a queue that gets no attention would get no
      weight, and so could never count against it.
    </p>
  </section>

  <section>
    <h2>Replay</h2>
    <p>
      The play button under the dials runs the clock, the dials and the doom
      loops through the whole record, from the repository's first commit to
      today, and on into the forecast. For each day the tracker's files give the
      state as it was known that day; between days the values are interpolated
      (ratios on a log scale) so the hands move smoothly.
    </p>
    <p>
      The agents' queue is older than the public issue tracker. The clock
      compares the two queues, so until the first public issue it shows no
      reading; the dials and doom loops show the agents' queue alone.
    </p>
    <p>
      A weighting preset derived from the data (by backlog size, by effort) is a
      rule, so the replay works its weight out afresh for each day. A fixed or
      dragged weight stays fixed.
    </p>
  </section>

  <section>
    <h2>Forecast</h2>
    <p>
      Past today the replay shows a forecast, simulated with the
      <a
        href="https://github.com/energese-project/GSSK-Giannantoni"
        target="_blank"
        rel="noopener noreferrer"
        >GSSK</a
      >
      kernel, which runs in the page as WebAssembly.
    </p>
    <ul>
      <li>
        <strong>The model.</strong> Each queue is a store of open issues. New
        issues flow in; agents and humans each resolve a share of the open
        backlog every day. GSSK integrates the flows (Runge–Kutta, four steps a
        day).
      </li>
      <li>
        <strong>Calibration.</strong> Each rate (new issues, resolved by agents,
        resolved by humans) is a count over the last week. Its uncertainty is
        the Bayesian posterior for a Poisson rate given that count, so a rate
        never seen, such as agents closing public issues, is small but not ruled
        out.
      </li>
      <li>
        <strong>Drift.</strong> Rates change. Each simulated run lets them
        wander day by day by as much as the 7-day rates have moved in the record
        (about 15% a day so far). The public record is too short to measure, so
        it borrows the agents' queue's figure.
      </li>
      <li>
        <strong>Ranges.</strong> 200 runs give, for every day, a median and a
        90% range: the grey fan on each dial and on the clock. The same seed is
        used for the same data, so a reload shows the same forecast.
      </li>
      <li>
        <strong>Where it stops.</strong> The forecast ends on the first day it
        is essentially random: when either queue's resolution rate is uncertain
        by a factor of ten or more, or the clock's likely range covers half the
        dial. The hands fade as that day approaches and are gone when it
        arrives.
      </li>
    </ul>
    <p>
      The forecast extends today's behaviour; it does not know about plans,
      releases or new agents. Agents resolving each day a share of what is open
      is an assumption, the simplest that fits a queue whose backlog the agents
      fill themselves.
    </p>
  </section>

  <section>
    <h2>Project outlook</h2>
    <p>
      The outlook asks whether the repository stays manageable, and when it
      would stop being so. Each class of issue has a limit on how long a new
      issue may wait:
    </p>
    <dl>
      <div>
        <dt>Security</dt>
        <dd>
          <span data-limit="security">7</span> days by default. Issues labelled
          as security or naming a CVE or GitHub advisory. With AI tools finding
          and weaponising vulnerabilities quickly, this is set tighter than the
          two weeks CISA allows US agencies for known exploited vulnerabilities.
        </dd>
      </div>
      <div>
        <dt>Bugs</dt>
        <dd>
          <span data-limit="bug">30</span> days: a common window for
          high-severity findings.
        </dd>
      </div>
      <div>
        <dt>Features and other</dt>
        <dd>
          <span data-limit="other">180</span> days: a request older than half a
          year is in effect abandoned.
        </dd>
      </div>
    </dl>
    <p>
      The limits are Action inputs. A new issue's expected wait follows Little's
      law: the open issues in its class divided by the class's resolutions per
      day. The repository is <strong>unmanageable</strong>
      once any class's expected wait passes its limit. A class with no issues on
      record (no security issues yet, say) is not judged.
    </p>
    <ul>
      <li>
        <strong>The forecast.</strong> GSSK simulates each class, with new
        issues filed by people and by agents, and resolutions by each. Rates are
        calibrated on the last week as Bayesian posteriors. Resolution rates are
        partially pooled: a class with little history starts from the
        repository's overall rate, and its own record takes over as it grows.
        150 runs give the chances below.
      </li>
      <li>
        <strong>Manageability index</strong>: the chance of staying manageable
        up to the forecast horizon, the point where the forecast stops being
        better than a guess.
      </li>
      <li>
        <strong>Loses control</strong>: the first day the chance of having lost
        control reaches 50%, with agents and humans, and again counting people's
        resolutions alone.
      </li>
      <li>
        <strong>Backlog cleared</strong>: when half (and 85%) of the simulations
        reach an empty backlog. While issues arrive at least as fast as they are
        resolved, there is no completion date.
      </li>
      <li>
        <strong>Agents</strong>: the same forecast run again without agents
        filing or resolving. Agents are a benefit if they lower the chance of
        losing control by at least 5 points, a burden if they raise it as much,
        and otherwise judged on the backlog they leave.
      </li>
      <li>
        <strong>Cost</strong>, once prices are set as Action inputs: what
        resolving issues costs a month now, what keeping pace with new issues
        would cost, and when that would exceed the budget. Without prices the
        dashboard shows no cost figures.
      </li>
      <li>
        <strong>Reliability</strong>: the model re-run from each past day of the
        record, checking how often its 7-day forecast of the backlog landed
        inside its 90% range. Around 90% means the ranges can be trusted; much
        less means the forecast is overconfident.
      </li>
    </ul>
  </section>

  <section>
    <h2>Indices</h2>
    <dl>
      <div>
        <dt>Public attention index</dt>
        <dd>
          With two queues: the public issues' share of resolutions divided by
          their share of the open backlog. At 1 they get attention in proportion
          to their size; below 1 they get less. It is the distance between the
          "by effort" and "by backlog" marks on the slider, as one number.
        </dd>
      </div>
      <div>
        <dt>Verified closure rate</dt>
        <dd>
          The share of closed issues whose closure references a fix (see "How
          issues were closed"). A low rate means closures cannot be checked
          against the record, whoever made them.
        </dd>
      </div>
      <div>
        <dt>Reopen rate</dt>
        <dd>
          The share of issues closed at least once that were later reopened:
          closures that did not hold.
        </dd>
      </div>
    </dl>
  </section>

  <section>
    <h2>Who resolves what</h2>
    <p>
      Every rate is shown for agents, for humans and for both. For GitHub
      issues, the resolver is the account that closed the issue. For a
      file-based queue, it is the author of the commit that added the file to
      the resolved folder: any author that is not an automation account counts
      as a human.
    </p>
  </section>

  <section>
    <h2>Resolution velocity</h2>
    <p>
      Each dial shows issues resolved per day, averaged over the last seven days
      (or all the data, while there is less than a week of it). The large dial
      combines both queues; the two smaller ones show each queue alone. All
      three keep one scale, from the busiest day of the whole record, so the
      needles can be compared across the replay and the live view.
    </p>
    <ul>
      <li>
        <strong>Needle</strong>: issues resolved per day by everyone, agents and
        humans together.
      </li>
      <li>
        <strong>Inner arc</strong>: the same rate split into AI agents (orange)
        and humans (purple), so their shares show at a glance.
      </li>
      <li>
        <strong>Blue mark</strong>: new issues per day, the change in open plus
        resolved issues.
      </li>
      <li>
        <strong>Odometer</strong>: the open backlog, the issues still waiting.
        It is a total, not a rate, so it sits under the dial rather than on it.
      </li>
      <li>
        <strong>Outer arc</strong>: the gap between the needle and the blue
        mark. Green and solid when issues are resolved faster than they arrive,
        so the backlog shrinks; red and dashed when they arrive faster, so it
        grows. The caption under each dial states the gap in words with ▲ or ▼,
        so it does not rely on colour.
      </li>
    </ul>
  </section>

  <section>
    <h2>Bug doom loop</h2>
    <p class="formula">
      Doom loop ratio = issues opened ÷ issues closed (last 7 days)
    </p>
    <p>
      The dashboard shows it three times in the same form: combined across both
      queues on top, then the agents' own queue (issues filed ÷ issues resolved)
      and the public GitHub issues beneath. The agents' panel answers whether
      agents resolve more issues than they file: below 1× they do.
    </p>
    <p>
      Issues opened are the change in open plus closed issues; issues closed
      count both agents and humans. Above 1× the backlog grows however hard
      everyone works. The meter uses a log scale from ⅛× to 8×, so halving and
      doubling look the same distance from break-even.
    </p>
    <ul>
      <li>
        <strong>Burning down</strong>: under 0.9×, the backlog is shrinking.
      </li>
      <li><strong>Holding steady</strong>: 0.9× to 1.1×.</li>
      <li><strong>Falling behind</strong>: 1.1× to 2×.</li>
      <li>
        <strong>Bug doom loop</strong>: over 2×, or issues arriving with none
        closed.
      </li>
    </ul>
    <p>
      The projection divides today's open backlog by the net daily change: how
      long until it doubles, or until it is empty.
    </p>
  </section>

  <section data-queue-only>
    <h2>The file-based queue</h2>
    <p>
      The queue is two folders in <span data-queue-repository></span>:
      <code data-queue-open></code> for open issues and
      <code data-queue-resolved></code> for resolved ones. The tracker counts
      the files in both at the last commit of each day, from the repository's
      first commit, and reads each commit's author; it reads nothing else.
      Resolved per day is the growth of the second folder; new per day is the
      growth of both together, so a retracted issue counts as one fewer filed.
    </p>
  </section>

  <section>
    <h2>How issues were closed</h2>
    <p>
      An issue marked closed is not necessarily an issue fixed. For every closed
      issue the tracker reads the closing event and the last 20 comments, and
      puts it in one of five groups:
    </p>
    <dl>
      <div>
        <dt>Fix referenced</dt>
        <dd>
          A commit or merged pull request closed it, or someone other than the
          reporter pointed to a commit or a release in a comment.
        </dd>
      </div>
      <div>
        <dt>Closed without a referenced fix</dt>
        <dd>Marked completed, with nothing recorded to check it against.</dd>
      </div>
      <div>
        <dt>Declined</dt>
        <dd>Closed as "not planned".</dd>
      </div>
      <div>
        <dt>Withdrawn</dt>
        <dd>Closed by the person who reported it, with no fix referenced.</dd>
      </div>
      <div>
        <dt>Duplicate</dt>
        <dd>Closed as a duplicate of another issue.</dd>
      </div>
    </dl>
    <p>
      The doom loop panel also shows the ratio
      <strong>counting only closures that reference a fix</strong>. The distance
      between that figure and the headline ratio is how much of the closing
      activity cannot be verified from the record.
    </p>
    <p>
      Two limits. A genuine fix that nobody linked lands in "closed without a
      referenced fix", so that group is an upper bound on unverified closures,
      not a finding about any one of them. And the tracker checks that a fix is
      referenced, not that the fix is correct.
    </p>
  </section>

  <section>
    <h2>Why a referenced fix is the test</h2>
    <p>
      The link from a closed issue to the commit, pull request or release that
      fixed it is the public trail from a report to its fix. Without it, a
      reader has to take the closure on trust. A best-in-class workflow records:
    </p>
    <ul>
      <li>
        <strong>Every fix links to its issue.</strong> "Fixes #123" in a pull
        request or commit makes GitHub close the issue and record the link, with
        no extra work, which an agent can do every time.
      </li>
      <li>
        <strong>The closing comment says where the fix shipped</strong>: the
        commit or release, so the reporter can confirm it.
      </li>
      <li>
        <strong>The closing reason is accurate</strong>: completed, not planned,
        or duplicate with a link to the original.
      </li>
      <li>
        <strong>Every issue is typed at triage</strong> with a label or issue
        type, so the backlog can be measured by kind.
      </li>
      <li>
        <strong>Internal and public queues are linked.</strong> When work
        tracked elsewhere resolves a public issue, each record points to the
        other.
      </li>
    </ul>
    <p>
      The "Get more from this dashboard" checklist on the dashboard checks
      several of these for this repository.
    </p>
  </section>

  <section>
    <h2>Issue types</h2>
    <p>The tracker reads each issue's type from its labels, then its form:</p>
    <ul>
      <li>
        <strong>Bug reports</strong>: a <code>bug</code>, <code>defect</code> or
        <code>regression</code> label, or the headings of a bug form or template
        ("What happened", "Steps to reproduce", "Describe the bug").
      </li>
      <li>
        <strong>Feature requests</strong>: an <code>enhancement</code> or
        <code>feature</code> label, or a feature form ("Use case", "Proposed
        solution").
      </li>
      <li><strong>Other</strong>: anything else.</li>
    </ul>
    <p>
      The doom loop panel shows the ratio for <strong>bug reports only</strong>
      alongside the headline, since a backlog of unfixed bugs and a backlog of
      unbuilt features are different problems.
    </p>
  </section>

  <section>
    <h2>Response times</h2>
    <dl>
      <div>
        <dt>Time to first response</dt>
        <dd>
          From an issue being opened to the first comment or closure by someone
          other than the reporter. Routine automation (GitHub Actions,
          Dependabot, stale bots) does not count as a response.
        </dd>
      </div>
      <div>
        <dt>Time to resolution</dt>
        <dd>
          From an issue being opened to its closure, leaving out issues the
          reporter withdrew and duplicates.
        </dd>
      </div>
    </dl>
    <p>
      Both are medians over issues opened in the last 30 days, with the time by
      which 90% were done: the standard service measures for an issue tracker.
    </p>
  </section>

  <section>
    <h2>Get more from this dashboard</h2>
    <p>
      Some measures depend on how the repository is run: issue forms and labels
      for issue types, linked fixes for verified closures, a schedule for fresh
      data. The tracker checks each habit, says what it found, and recommends a
      change with a link to GitHub's documentation. Where it cannot measure
      something, it says so rather than guess.
    </p>
  </section>

  <p><a href="/" class="back">← Back to the dashboard</a></p>
</main>
`,o=`:host {
  display: block;
}
:host .doc {
  max-width: 720px;
  margin: 0 auto;
  padding: 3rem 1rem 4rem;
  line-height: 1.65;
  color: var(--ink-2);
}
:host h1 {
  margin: 0.5rem 0 1rem;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--ink);
}
:host h2 {
  margin: 2.25rem 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--ink);
}
:host .lede {
  font-size: 1.0625rem;
}
:host a {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}
:host code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--surface-2);
}
:host ul {
  padding-left: 1.25rem;
}
:host li + li {
  margin-top: 0.25rem;
}
:host dl div {
  display: grid;
  grid-template-columns: 9rem 1fr;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--grid);
}
:host dd {
  margin: 0;
}
:host .formula {
  padding: 1rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-weight: 600;
  text-align: center;
}
:host .back {
  display: inline-block;
  margin-top: 2rem;
  font-weight: 600;
}
:host .why {
  margin: 1.5rem 0 2rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--series-1);
  border-radius: 12px;
  background: var(--surface);
}
:host .why h2 {
  margin-top: 0;
}
:host .why p:last-child {
  margin-bottom: 0;
}
:host .why p + p {
  margin-top: 0.75rem;
}
`,s=class extends e{static tagName=`methodology-page`;constructor(){super(a,o)}init(){this.querySelector(`[data-csv-link]`).href=r,this.querySelector(`[data-project-link]`).href=t,n().then(e=>{let t=this.querySelector(`[data-tracked-link]`);if(t.href=e.issuesUrl||e.repositoryUrl,t.textContent=e.repository,this.querySelectorAll(`[data-queue-only]`).forEach(t=>t.hidden=!e.queue),e.queue){let t=(e,t)=>{this.querySelector(e).textContent=t};t(`[data-queue-repository]`,e.queue.repository),t(`[data-queue-open]`,e.queue.openDir),t(`[data-queue-resolved]`,e.queue.resolvedDir)}for(let[t,n]of Object.entries(e.limits)){let e=this.querySelector(`[data-limit="${t}"]`);e&&(e.textContent=String(n))}let n=this.querySelector(`[data-why]`);if(n.hidden=!e.why,e.why){this.querySelector(`[data-why-text]`).textContent=e.why.text;let t=this.querySelector(`[data-why-source]`);t.hidden=!e.why.url,this.querySelector(`[data-why-link]`).href=e.why.url}}),i().then(e=>{if(!e)return;let{description:t,runTimesUtc:n}=e.schedule;this.querySelector(`[data-schedule]`).textContent=n.length?`${t} (${n.join(`, `)} UTC)`:t})}};customElements.get(s.tagName)||customElements.define(s.tagName,s);export{s as MethodologyPageComponent};
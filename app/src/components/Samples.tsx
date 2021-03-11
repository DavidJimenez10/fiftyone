import React from "react";
import InfiniteScroll from "react-infinite-scroller";
import useMeasure from "react-use-measure";
import { useRecoilValue } from "recoil";
import styled from "styled-components";

import Loading from "./Loading";
import Sample from "./Sample";
import tile from "./Samples.hooks";
import * as selectors from "../recoil/selectors";
import { scrollbarStyles } from "./utils";

const Container = styled.div`
  ${scrollbarStyles}
  overflow-y: scroll;
  overflow-x: hidden;
  height: 100%;
`;

function Samples() {
  const [containerRef, bounds] = useMeasure();

  const [rows, scrollState, setScrollState] = tile();
  const indices = useRecoilValue(selectors.sampleIndices);

  return (
    <Container ref={containerRef}>
      <InfiniteScroll
        pageStart={1}
        initialLoad={true}
        loadMore={() =>
          !scrollState.isLoading && !scrollState.loadMore
            ? setScrollState({ ...scrollState, loadMore: true })
            : null
        }
        hasMore={scrollState.hasMore}
        useWindow={false}
      >
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <div
              columns={r.columns}
              style={{
                ...r.style,
                height: (bounds.width - 16) / r.aspectRatio,
              }}
              key={i}
            >
              {r.samples.map((s, j) => (
                <React.Fragment key={j}>
                  <div key={"column"} style={{ padding: 0, width: "100%" }}>
                    <Sample
                      sample_id={s.sample._id}
                      metadata={s.metadata}
                      index={indices[s.sample._id]}
                    />
                  </div>
                  {j < r.samples.length - 1 && (
                    <div
                      key={"separator"}
                      style={{ padding: 0, width: "100%" }}
                    />
                  )}
                </React.Fragment>
              ))}
              {Array.from(Array(r.extraMargins).keys()).map((i) => (
                <div
                  key={`separator-${i}`}
                  style={{ padding: 0, width: "100%" }}
                />
              ))}
            </div>
            <div
              style={{ width: "100%", display: "block", paddingTop: "0.2%" }}
            />
          </React.Fragment>
        ))}
      </InfiniteScroll>
      {scrollState.isLoading && rows.length === 0 ? <Loading /> : null}
    </Container>
  );
}

export default React.memo(Samples);

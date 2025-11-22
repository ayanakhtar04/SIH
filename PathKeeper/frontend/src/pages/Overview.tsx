import React from 'react';
import App from '../App';

type OverviewProps = { appRef?: any; navOpen?: boolean };

const Overview: React.FC<OverviewProps> = ({ appRef, navOpen }) => {
  // @ts-ignore forwardRef
  return <App ref={appRef} navOpen={navOpen} />;
};

export default Overview;

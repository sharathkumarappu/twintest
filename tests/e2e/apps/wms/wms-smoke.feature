Feature: WMS Smart Client - Smoke Tests
  As a warehouse operator
  I want to verify the WMS Smart Client launches and authenticates
  So that I can confirm the ClickOnce deployment is functional

  Scenario: Login to WMS Smart Client
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 20 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Warehouse
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 20 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the WarehouseButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Warehouse Gateway
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 20 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the WarehouseGatewayButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Transportation
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 20 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the TransportationButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage

  Scenario: Login and navigate to Output Manager
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 30 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the OutputManagerButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage

  Scenario: DB health check
    * Verify connection to the database
    * Run query select * from v$session where blocking_session is not NULL and seconds_in_wait > 60 and store results to queryResult
    * Assert that the number of entries in queryResult is equal to - 0
    * Run query SELECT * FROM dba_indexes WHERE status = 'UNUSABLE' and store results to queryResult
    * Assert that the number of entries in queryResult is equal to - 0
    * Run query SELECT * FROM dba_ind_PARTITIONS WHERE status = 'UNUSABLE' and store results to queryResult
    * Assert that the number of entries in queryResult is equal to - 0
    * Run query select * from dba_objects WHERE status <> 'VALID' and OBJECT_TYPE <> 'MATERIALIZED VIEW' and store results to queryResult
    * Assert that the number of entries in queryResult is equal to - 0
    * Run query select * from DBA_SCHEDULER_RUNNING_JOBS where owner='P1AHGS' and store results to queryResult
    * Assert that the number of entries in queryResult is greater than - 38

  Scenario: Verify Main Url and Fallback Url populated in Output Manager
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 30 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the OutputManagerButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Press ALT, then S1 to navigate to Output Manager
    * Click the SearchButton on the OutputManagerPage
    * Assert the value of element MainUrlCell on OutputManagerPage is not empty
    * Assert the value of element FallbackUrlCell on OutputManagerPage is not empty

  @App-WMS
  Scenario: Verify List of Ship From Nodes in Transportation
    * Update context nodeType -> Ship From
    * Fill input UsernameInput on the LoginPage with text: CONTEXT-username
    * Fill input PasswordInput on the LoginPage with text: CONTEXT-password
    * Click the LoginButton on the LoginPage
    * Wait 20 seconds
    * Switch to the next active window
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Click the TransportationButton on the LeftPanelMenuPage
    * If present, click the OKButton on the ChangeUserSettingsPage
    * Press ALT, then S3 to navigate to Node
    * Click the TypeCombobox on the NodePage
    * Click the CONTEXT-nodeType on the NodePage
    * Click the SearchButton on the NodePage
    * Fill input NodeDescriptionInput on the NodePage with text: DCT
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals DCT
    * Fill input NodeDescriptionInput on the NodePage with text: DCZ
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals DCZ
    * Fill input NodeDescriptionInput on the NodePage with text: DCO
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals DCO
    * Fill input NodeDescriptionInput on the NodePage with text: DCP
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals DCP
    * Fill input NodeDescriptionInput on the NodePage with text: LDC
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals LDC
    * Fill input NodeDescriptionInput on the NodePage with text: DCM-DCZ
    * Click the SearchButton on the NodePage
    * Assert the value of Name attribute for DescriptionCell element on NodePage equals DCM-DCZ
